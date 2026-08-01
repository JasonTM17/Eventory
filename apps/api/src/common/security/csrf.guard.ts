import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../auth/auth.constants.js';
import { getRequestCookie } from '../auth/cookie.util.js';
import { createTrustedOrigins, isTrustedOrigin } from './origin-policy.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor(private readonly config: ConfigService) {
    this.allowedOrigins = createTrustedOrigins(this.config.getOrThrow<string>('CORS_ORIGINS'));
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;
    if (!this.hasSessionCookie(request)) return true;

    const origin = request.header('origin');
    if (!origin || isTrustedOrigin(origin, this.allowedOrigins)) return true;

    throw new ForbiddenException({
      code: 'CSRF_ORIGIN_DENIED',
      message: 'Cross-origin mutation rejected',
    });
  }

  private hasSessionCookie(request: Request): boolean {
    return Boolean(
      getRequestCookie(request, ACCESS_TOKEN_COOKIE) ||
      getRequestCookie(request, REFRESH_TOKEN_COOKIE),
    );
  }
}
