import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OutboxService } from '../src/modules/outbox/outbox.service.js';

describe('outbox failure boundaries', () => {
  it('records a claim failure without creating an unhandled rejection', async () => {
    const prisma = {
      $queryRaw: async () => {
        throw new Error('database unavailable');
      },
    };
    const outbox = new OutboxService(prisma as never, {} as never);

    assert.equal(await outbox.processOnce(), 0);
    assert.equal(outbox.getClaimFailureCount(), 1);
  });
});
