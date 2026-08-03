import { z } from 'zod';
import { URL } from 'node:url';

const localSessionSecret = 'eventory-local-session-secret-change-me';
const localQrSecret = 'eventory-local-qr-signing-secret-change-me';
const localMockPaymentSecret = 'eventory-local-mock-payment-secret-change-me';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4_000),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://eventory:eventory@localhost:5432/eventory?schema=public'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  SESSION_SECRET: z.string().min(32).default(localSessionSecret),
  QR_SIGNING_SECRET: z.string().min(32).default(localQrSecret),
  QR_SIGNING_KEYS: z.string().max(4_000).default(''),
  QR_KEY_VERSION: z.coerce.number().int().min(1).max(100).default(1),
  MOCK_PAYMENT_WEBHOOK_SECRET: z.string().min(32).default(localMockPaymentSecret),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).max(10_000).default(120),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).max(3_600).default(60),
  METRICS_TOKEN: z.string().max(200).default(''),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(300).max(31_536_000).default(2_592_000),
  SEAT_HOLD_TTL_SECONDS: z.coerce.number().int().min(30).max(1_800).default(600),
  MAILPIT_HOST: z.string().min(1).default('localhost'),
  MAILPIT_PORT: z.coerce.number().int().min(1).max(65_535).default(1_025),
  MAIL_FROM: z.string().email().default('no-reply@eventory.local'),
  OUTBOX_WORKER_ENABLED: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default(() => false),
  BOOKING_RECONCILIATION_WORKER_ENABLED: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default(() => false),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
});

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(input: Record<string, unknown> = process.env): Environment {
  const environment = environmentSchema.parse(input);

  if (environment.NODE_ENV === 'production') {
    if (environment.SESSION_SECRET === localSessionSecret) {
      throw new Error('SESSION_SECRET must be replaced before running in production');
    }

    if (environment.QR_SIGNING_SECRET === localQrSecret) {
      throw new Error('QR_SIGNING_SECRET must be replaced before running in production');
    }

    if (environment.MOCK_PAYMENT_WEBHOOK_SECRET === localMockPaymentSecret) {
      throw new Error('MOCK_PAYMENT_WEBHOOK_SECRET must be replaced before running in production');
    }

    if (!environment.METRICS_TOKEN) {
      throw new Error('METRICS_TOKEN must be configured before running in production');
    }
  }

  return environment;
}

export function getCorsOrigins(value: string): string[] {
  const configuredOrigins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must contain at least one HTTP(S) origin');
  }

  return [...new Set(configuredOrigins.map(parseCorsOrigin))];
}

function parseCorsOrigin(value: string): string {
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error('not a serialized HTTP(S) origin');
    }
    return url.origin;
  } catch {
    throw new Error(`Invalid CORS origin: ${value}`);
  }
}
