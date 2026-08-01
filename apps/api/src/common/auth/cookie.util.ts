import type { Request } from 'express';

export function getRequestCookie(request: Request, name: string): string | undefined {
  const parsedCookies = request.cookies as Record<string, string> | undefined;
  if (parsedCookies?.[name]) return parsedCookies[name];

  const raw = request.headers.cookie;
  if (!raw) return undefined;

  for (const part of raw.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }

  return undefined;
}
