import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getCorsOrigins } from '@eventory/config';
import type { Request } from 'express';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../auth/auth.constants.js';
import { getRequestCookie } from '../auth/cookie.util.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor(private readonly config: ConfigService) {
    this.allowedOrigins = new Set(
      getCorsOrigins(this.config.getOrThrow<string>('CORS_ORIGINS')).map((origin) =>
        origin.replace(/\/$/, ''),
      ),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;
    if (!this.hasSessionCookie(request)) return true;

    const origin = request.header('origin');
    if (!origin || this.allowedOrigins.has(origin.replace(/\/$/, ''))) return true;

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
