import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

export type PaymentWebhookType = 'payment.succeeded' | 'payment.failed' | 'payment.expired';

export interface CreatePaymentInput {
  bookingId: string;
  amountMinor: number;
  currency: string;
  expiresAt: Date;
  idempotencyKey: string;
}

export interface CreatedPayment {
  providerReference: string;
  clientSecret: string;
  expiresAt: Date;
}

export interface PaymentWebhookPayload {
  id: string;
  type: PaymentWebhookType;
  reference: string;
  amountMinor: number;
  currency: string;
}

export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<CreatedPayment>;
  verifyWebhook(payload: string, signature: string | undefined): PaymentWebhookPayload;
}

export function serializeWebhookPayload(payload: PaymentWebhookPayload): string {
  return JSON.stringify({
    id: payload.id,
    type: payload.type,
    reference: payload.reference,
    amountMinor: payload.amountMinor,
    currency: payload.currency,
  });
}

export class MockPaymentProvider implements PaymentProvider {
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>('MOCK_PAYMENT_WEBHOOK_SECRET');
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatedPayment> {
    const identity = createHash('sha256')
      .update(`${this.secret}:${input.idempotencyKey}`)
      .digest('hex');
    return {
      // The mock deliberately derives its response from the durable key. This
      // models a provider idempotency contract even if the API process restarts
      // after the provider accepted the request but before Eventory persisted
      // the response.
      providerReference: `mock_${identity.slice(0, 32)}`,
      clientSecret: `mock_client_${identity}`,
      expiresAt: input.expiresAt,
    };
  }

  verifyWebhook(payload: string, signature: string | undefined): PaymentWebhookPayload {
    const expected = createHmac('sha256', this.secret).update(payload).digest('hex');
    if (!signature || signature.length !== expected.length) throw this.invalidSignature();
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(signature, 'utf8');
    if (!timingSafeEqual(expectedBuffer, providedBuffer)) throw this.invalidSignature();

    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new UnauthorizedException({
        code: 'PAYMENT_WEBHOOK_INVALID',
        message: 'Payment webhook payload is invalid',
      });
    }
    return parsed as PaymentWebhookPayload;
  }

  signPayload(payload: PaymentWebhookPayload): string {
    return createHmac('sha256', this.secret).update(serializeWebhookPayload(payload)).digest('hex');
  }

  private invalidSignature(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'PAYMENT_WEBHOOK_SIGNATURE_INVALID',
      message: 'Payment webhook signature is invalid',
    });
  }
}
