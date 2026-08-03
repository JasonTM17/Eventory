import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { Prisma, UserStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { UsersService } from '../users/users.service.js';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../../common/auth/auth.constants.js';
import { getRequestCookie } from '../../common/auth/cookie.util.js';
import type { AccessTokenPayload, AuthenticatedUser } from '../../common/auth/auth.types.js';
import { assertPasswordPolicy } from './password-policy.js';

interface SessionUser {
  id: string;
  role: AuthenticatedUser['role'];
  email: string;
  displayName: string;
}

interface RotatedSession {
  kind: 'rotated';
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
}

interface InvalidSession {
  kind: 'invalid' | 'reuse';
  familyId?: string;
}

@Injectable()
export class IdentityService {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async register(
    input: { email: string; displayName: string; password: string },
    response: Response,
    request: Request,
  ): Promise<{ user: AuthenticatedUser }> {
    assertPasswordPolicy(input.password);
    const email = this.normalizeEmail(input.email);

    let user: SessionUser;
    try {
      const passwordHash = await argon2.hash(input.password, {
        type: argon2.argon2id,
        memoryCost: 19_456,
        timeCost: 2,
        parallelism: 1,
      });
      user = await this.users.create({
        email,
        displayName: input.displayName.trim(),
        passwordHash,
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) throw this.registrationConflict();
      throw error;
    }

    await this.issueSession(user, response);
    await this.recordAudit('USER_REGISTERED', user.id, request);
    return { user: this.toPublicUser(user) };
  }

  async login(
    input: { email: string; password: string },
    response: Response,
    request: Request,
  ): Promise<{ user: AuthenticatedUser }> {
    const user = await this.users.findByEmail(this.normalizeEmail(input.email));
    const valid = user
      ? await argon2.verify(user.passwordHash, input.password).catch(() => false)
      : false;
    if (!user || !valid || user.status !== UserStatus.ACTIVE) throw this.invalidCredentials();

    await this.issueSession(user, response);
    await this.recordAudit('USER_LOGGED_IN', user.id, request);
    return { user: this.toPublicUser(user) };
  }

  async refresh(request: Request, response: Response): Promise<{ user: AuthenticatedUser }> {
    const rawToken = getRequestCookie(request, REFRESH_TOKEN_COOKIE);
    if (!rawToken) throw this.invalidCredentials();

    const result = await this.rotateRefreshToken(rawToken);
    if (result.kind === 'reuse') {
      if (result.familyId) {
        await this.prisma.refreshToken.updateMany({
          where: { familyId: result.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REUSE',
        message: 'Refresh session is no longer valid',
      });
    }
    if (result.kind === 'invalid') throw this.invalidCredentials();

    if (result.kind !== 'rotated') throw this.invalidCredentials();

    this.setSessionCookies(response, result.accessToken, result.refreshToken);
    await this.recordAudit('SESSION_REFRESHED', result.user.id, request);
    return { user: this.toPublicUser(result.user) };
  }

  async logout(request: Request, response: Response): Promise<{ success: true }> {
    const rawToken = getRequestCookie(request, REFRESH_TOKEN_COOKIE);
    if (rawToken) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: this.hashToken(rawToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    const actorUserId = (request as Request & { user?: { id?: string } }).user?.id;
    if (actorUserId) await this.recordAudit('USER_LOGGED_OUT', actorUserId, request);
    response.clearCookie(ACCESS_TOKEN_COOKIE, this.cookieOptions('/'));
    response.clearCookie(REFRESH_TOKEN_COOKIE, this.cookieOptions('/'));
    this.clearLegacySessionCookies(response);
    return { success: true };
  }

  private async rotateRefreshToken(rawToken: string): Promise<RotatedSession | InvalidSession> {
    const tokenHash = this.hashToken(rawToken);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (!current) return { kind: 'invalid' };

      const now = new Date();
      if (current.usedAt || current.revokedAt || current.expiresAt <= now) {
        return { kind: 'reuse', familyId: current.familyId };
      }

      const consumed = await tx.refreshToken.updateMany({
        where: { id: current.id, usedAt: null, revokedAt: null },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) return { kind: 'reuse', familyId: current.familyId };

      const refreshToken = randomBytes(32).toString('base64url');
      const accessToken = await this.signAccessToken(current.user);
      await tx.refreshToken.create({
        data: {
          userId: current.userId,
          tokenHash: this.hashToken(refreshToken),
          familyId: current.familyId,
          expiresAt: this.refreshExpiry(),
        },
      });
      return {
        kind: 'rotated',
        user: current.user,
        accessToken,
        refreshToken,
      };
    });
  }

  private async issueSession(user: SessionUser, response: Response): Promise<void> {
    const refreshToken = randomBytes(32).toString('base64url');
    const accessToken = await this.signAccessToken(user);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        familyId: randomUUID(),
        expiresAt: this.refreshExpiry(),
      },
    });
    this.setSessionCookies(response, accessToken, refreshToken);
  }

  private async signAccessToken(user: SessionUser): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role, tokenType: 'access' };
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('SESSION_SECRET'),
      expiresIn: this.config.getOrThrow<number>('ACCESS_TOKEN_TTL_SECONDS'),
    });
  }

  private setSessionCookies(response: Response, accessToken: string, refreshToken: string): void {
    response.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...this.cookieOptions('/'),
      maxAge: this.config.getOrThrow<number>('ACCESS_TOKEN_TTL_SECONDS') * 1_000,
    });
    response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      ...this.cookieOptions('/'),
      maxAge: this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_SECONDS') * 1_000,
    });
    this.clearLegacySessionCookies(response);
  }

  private clearLegacySessionCookies(response: Response): void {
    response.clearCookie(ACCESS_TOKEN_COOKIE, this.cookieOptions('/api'));
    response.clearCookie(REFRESH_TOKEN_COOKIE, this.cookieOptions('/api/v1/auth'));
  }

  private cookieOptions(path: string): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax';
    path: string;
  } {
    return {
      httpOnly: true,
      secure: this.config.getOrThrow<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path,
    };
  }

  private refreshExpiry(): Date {
    return new Date(
      Date.now() + this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_SECONDS') * 1_000,
    );
  }

  private normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toPublicUser(user: SessionUser): AuthenticatedUser {
    return { id: user.id, role: user.role, email: user.email, displayName: user.displayName };
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
  }

  private registrationConflict(): ConflictException {
    return new ConflictException({
      code: 'REGISTRATION_CONFLICT',
      message: 'Unable to create an account with the supplied details',
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private async recordAudit(action: string, userId: string, request: Request): Promise<void> {
    await this.audit.record({
      action,
      resourceType: 'User',
      resourceId: userId,
      actorUserId: userId,
      ...(request.ip ? { ipAddress: request.ip } : {}),
    });
  }
}
