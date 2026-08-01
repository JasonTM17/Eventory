import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { RateLimitGuard } from '../src/common/security/rate-limit.guard.js';

describe('RateLimitGuard', () => {
  it('blocks a client after the configured route budget', () => {
    const handler = (): void => undefined;
    const klass = class TestController {};
    const response = {
      headers: new Map<string, string>(),
      setHeader(name: string, value: string): void {
        this.headers.set(name, value);
      },
    };
    const context = {
      getHandler: () => handler,
      getClass: () => klass,
      switchToHttp: () => ({
        getRequest: () => ({ ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } }),
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
    const guard = new RateLimitGuard(
      { getAllAndOverride: () => ({ max: 2, windowSeconds: 60 }) } as never,
      { getOrThrow: () => 120 } as never,
    );

    assert.equal(guard.canActivate(context), true);
    assert.equal(guard.canActivate(context), true);
    assert.throws(
      () => guard.canActivate(context),
      (error: unknown) => error instanceof HttpException && error.getStatus() === 429,
    );
    assert.equal(response.headers.get('Retry-After'), '60');
  });
});
