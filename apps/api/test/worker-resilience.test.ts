import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BookingReconciliationWorker } from '../src/modules/bookings/booking-reconciliation.worker.js';
import { OutboxWorker } from '../src/modules/outbox/outbox.worker.js';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe('worker cycle boundaries', () => {
  it('does not overlap outbox cycles', async () => {
    const gate = deferred();
    let calls = 0;
    const worker = new OutboxWorker(
      { getOrThrow: () => true } as never,
      {
        processOnce: async () => {
          calls += 1;
          await gate.promise;
          return 0;
        },
        getClaimFailureCount: () => 0,
      } as never,
    );
    const runCycle = (worker as unknown as { runCycle: () => Promise<void> }).runCycle.bind(worker);

    const first = runCycle();
    const second = runCycle();
    await Promise.resolve();
    assert.equal(calls, 1);
    gate.resolve();
    await Promise.all([first, second]);
  });

  it('does not overlap pending-booking expiry cycles', async () => {
    const gate = deferred();
    let calls = 0;
    const worker = new BookingReconciliationWorker(
      { getOrThrow: () => true } as never,
      {
        recoverPendingProviderPayments: async () => 0,
        expirePendingBookings: async () => {
          calls += 1;
          await gate.promise;
          return 0;
        },
        reconcilePendingPaymentWebhooks: async () => 0,
      } as never,
    );
    const runCycle = (worker as unknown as { runCycle: () => Promise<void> }).runCycle.bind(worker);

    const first = runCycle();
    const second = runCycle();
    await Promise.resolve();
    assert.equal(calls, 1);
    gate.resolve();
    await Promise.all([first, second]);
  });
});
