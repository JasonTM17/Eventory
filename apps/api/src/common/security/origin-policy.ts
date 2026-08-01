import { ForbiddenException } from '@nestjs/common';
import { getCorsOrigins } from '@eventory/config';
import type { Request } from 'express';
import { URL } from 'node:url';

export const TRUSTED_SERVICE_CLIENT_HEADER = 'x-eventory-client';
const TRUSTED_SERVICE_CLIENT_VALUE = 'server';

interface OriginDenial {
  code: string;
  message: string;
}

export function createTrustedOrigins(configuredOrigins: string): Set<string> {
  return new Set(getCorsOrigins(configuredOrigins));
}

export function isTrustedOrigin(
  value: string | undefined,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  const origin = value ? parseSerializedOrigin(value) : undefined;
  return Boolean(origin && allowedOrigins.has(origin));
}

export function assertTrustedSessionIssuer(
  request: Request,
  allowedOrigins: ReadonlySet<string>,
): void {
  const origin = request.header('origin');
  if (origin !== undefined) {
    if (isTrustedOrigin(origin, allowedOrigins)) return;
    denySessionIssuance();
  }

  const referer = request.header('referer');
  if (referer !== undefined) {
    if (isTrustedReferer(referer, allowedOrigins)) return;
    denySessionIssuance();
  }

  // Browser Fetch Metadata cannot be forged by web content. Headerless callers
  // must opt into the service-to-service contract with a non-simple header.
  if (
    request.header('sec-fetch-site') !== undefined ||
    request.header(TRUSTED_SERVICE_CLIENT_HEADER) !== TRUSTED_SERVICE_CLIENT_VALUE
  ) {
    denySessionIssuance();
  }
}

function isTrustedReferer(value: string, allowedOrigins: ReadonlySet<string>): boolean {
  try {
    const url = new URL(value);
    return isHttpOrigin(url.origin) && allowedOrigins.has(url.origin);
  } catch {
    return false;
  }
}

function parseSerializedOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (
      !isHttpOrigin(url.origin) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    ) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

function isHttpOrigin(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

function denySessionIssuance(): never {
  throw new ForbiddenException({
    code: 'SESSION_ORIGIN_DENIED',
    message: 'Session issuance from this origin is not allowed',
  } satisfies OriginDenial);
}
