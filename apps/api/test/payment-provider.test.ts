import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { MockPaymentProvider } from '../src/modules/payments/payment-provider.js';

describe('mock payment provider idempotency', () => {
  it('returns the same provider identity when a request is retried', async () => {
    const provider = new MockPaymentProvider(
      new ConfigService({ MOCK_PAYMENT_WEBHOOK_SECRET: 'test-secret' }),
    );
    const input = {
      bookingId: 'booking-1',
      amountMinor: 100_000,
      currency: 'VND',
      expiresAt: new Date('2026-08-02T12:00:00.000Z'),
      idempotencyKey: 'booking:booking-1',
    };

    const first = await provider.createPayment(input);
    const retried = await provider.createPayment(input);

    assert.deepEqual(retried, first);
    assert.notEqual(
      first.providerReference,
      (await provider.createPayment({ ...input, idempotencyKey: 'booking:booking-2' }))
        .providerReference,
    );
  });
});
