import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { ACCESS_TOKEN_COOKIE, PUBLIC_ROUTE_METADATA } from './auth.constants.js';
import { getRequestCookie } from './cookie.util.js';
import type { AccessTokenPayload, RequestWithUser } from './auth.types.js';
import type { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & RequestWithUser>();
    const token = this.getAccessToken(request);
    if (!token) throw this.authenticationError();

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('SESSION_SECRET'),
      });
      if (payload.tokenType !== 'access' || !payload.sub) throw this.authenticationError();

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.status !== UserStatus.ACTIVE) throw this.authenticationError();

      request.user = {
        id: user.id,
        role: user.role,
        email: user.email,
        displayName: user.displayName,
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw this.authenticationError();
    }
  }

  private getAccessToken(request: Request): string | undefined {
    const cookieToken = getRequestCookie(request, ACCESS_TOKEN_COOKIE);
    if (cookieToken) return cookieToken;
    const authorization = request.header('authorization');
    if (!authorization?.startsWith('Bearer ')) return undefined;
    return authorization.slice('Bearer '.length).trim() || undefined;
  }

  private authenticationError(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication is required',
    });
  }
}
