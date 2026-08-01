import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { assertTrustedSessionIssuer, createTrustedOrigins } from './origin-policy.js';
import { SESSION_ISSUANCE_METADATA } from './session-issuance.decorator.js';

@Injectable()
export class SessionOriginGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {
    this.allowedOrigins = createTrustedOrigins(this.config.getOrThrow<string>('CORS_ORIGINS'));
  }

  canActivate(context: ExecutionContext): boolean {
    const issuesSession = this.reflector.getAllAndOverride<boolean>(SESSION_ISSUANCE_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!issuesSession) return true;

    assertTrustedSessionIssuer(context.switchToHttp().getRequest<Request>(), this.allowedOrigins);
    return true;
  }
}
