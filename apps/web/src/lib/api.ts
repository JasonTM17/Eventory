import type { ApiErrorBody } from '@eventory/contracts';

const defaultApiBaseUrl = 'http://localhost:4000/api/v1';

export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? defaultApiBaseUrl;

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: Partial<ApiErrorBody>,
  ) {
    super(body.message ?? 'Request failed');
    this.name = 'ApiRequestError';
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  cookieHeader?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (cookieHeader) headers.set('cookie', cookieHeader);

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
    credentials: 'include',
  });
  if (response.ok) return (await response.json()) as T;

  let body: Partial<ApiErrorBody> = {};
  try {
    body = (await response.json()) as Partial<ApiErrorBody>;
  } catch {
    body = { message: response.statusText };
  }
  throw new ApiRequestError(response.status, body);
}

export function isApiError(error: unknown, status?: number): error is ApiRequestError {
  return error instanceof ApiRequestError && (status === undefined || error.status === status);
}
