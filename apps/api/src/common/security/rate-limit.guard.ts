import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { RATE_LIMIT_METADATA } from '../auth/auth.constants.js';
import type { RateLimitOptions } from '../auth/auth.decorators.js';

interface Bucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const override = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(
      RATE_LIMIT_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!override) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const max = this.safeLimit(
      override.max,
      this.config.getOrThrow<number>('RATE_LIMIT_MAX_REQUESTS'),
    );
    const windowSeconds = this.safeWindow(
      override.windowSeconds,
      this.config.getOrThrow<number>('RATE_LIMIT_WINDOW_SECONDS'),
    );
    const now = Date.now();
    const key = `${this.routeKey(context)}:${this.clientKey(request)}`;
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowSeconds * 1_000 };
      this.buckets.set(key, bucket);
    }

    response.setHeader('X-RateLimit-Limit', String(max));
    response.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    response.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1_000)));

    if (bucket.count >= max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000));
      response.setHeader('Retry-After', String(retryAfter));
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
          details: { retryAfterSeconds: retryAfter },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    bucket.count += 1;
    response.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    this.prune(now);
    return true;
  }

  private routeKey(context: ExecutionContext): string {
    return `${context.getClass().name}:${context.getHandler().name}`;
  }

  private clientKey(request: Request): string {
    return request.ip ?? request.socket.remoteAddress ?? 'unknown';
  }

  private safeLimit(value: number, fallback: number): number {
    return Number.isInteger(value) && value > 0 ? Math.min(value, 10_000) : fallback;
  }

  private safeWindow(value: number, fallback: number): number {
    return Number.isInteger(value) && value > 0 ? Math.min(value, 3_600) : fallback;
  }

  private prune(now: number): void {
    if (this.buckets.size <= 10_000) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
    while (this.buckets.size > 10_000) {
      const first = this.buckets.keys().next().value;
      if (!first) break;
      this.buckets.delete(first);
    }
  }
}
