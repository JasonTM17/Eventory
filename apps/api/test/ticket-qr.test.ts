import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { TicketQrService } from '../src/modules/tickets/ticket-qr.service.js';

function createQr(): TicketQrService {
  return new TicketQrService(
    new ConfigService({
      QR_KEY_VERSION: 1,
      QR_SIGNING_SECRET: 'test-qr-signing-secret-that-is-long-enough',
    }),
  );
}

describe('ticket QR signing', () => {
  it('signs a session-bound payload without exposing a raw session identifier', () => {
    const qr = createQr();
    const eventSessionId = '7dfc9ad7-1b8e-4d7e-9bd9-2df6ad3f2f18';
    const payload = qr.createPayload({
      publicCode: 'TKT-ABCDEF1234567890',
      eventSessionId,
      qrNonce: '2cddf9c4-5304-4d05-9a17-9b2a00f4a91d',
      qrKeyVersion: 1,
    });

    assert.ok(!payload.includes(eventSessionId));
    const verified = qr.verifyPayload(payload);
    assert.deepEqual(verified, {
      version: 1,
      keyVersion: 1,
      publicCode: 'TKT-ABCDEF1234567890',
      sessionBinding: qr.sessionBinding(eventSessionId),
      qrNonce: '2cddf9c4-5304-4d05-9a17-9b2a00f4a91d',
    });
  });

  it('rejects forged signatures and payloads bound to another session', () => {
    const qr = createQr();
    const payload = qr.createPayload({
      publicCode: 'TKT-ABCDEF1234567890',
      eventSessionId: '7dfc9ad7-1b8e-4d7e-9bd9-2df6ad3f2f18',
      qrNonce: '2cddf9c4-5304-4d05-9a17-9b2a00f4a91d',
      qrKeyVersion: 1,
    });
    const forged = `${payload.slice(0, -1)}${payload.endsWith('A') ? 'B' : 'A'}`;
    assert.equal(qr.verifyPayload(forged), null);

    const parts = payload.split('.');
    parts[4] = qr.sessionBinding('d3bcf2a5-08a1-4a0e-a9a1-a409eb4fb1f1');
    assert.equal(qr.verifyPayload(parts.join('.')), null);
  });
});
