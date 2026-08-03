import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bookingKeyStorageKey,
  clearConfirmedCheckoutStorage,
  holdStorageKey,
} from './checkout-storage.js';

function createStorage(): {
  entries: Map<string, string>;
  storage: Pick<Storage, 'removeItem'>;
} {
  const entries = new Map<string, string>();
  return {
    entries,
    storage: {
      removeItem(key: string): void {
        entries.delete(key);
      },
    },
  };
}

describe('confirmed checkout storage', () => {
  it('clears only the completed hold and its idempotency key', () => {
    const eventSessionId = 'session-a';
    const holdId = 'hold-a';
    const otherHoldId = 'hold-b';
    const { entries, storage } = createStorage();

    entries.set(holdStorageKey(eventSessionId), 'completed hold');
    entries.set(bookingKeyStorageKey(eventSessionId, holdId), 'completed key');
    entries.set(bookingKeyStorageKey(eventSessionId, otherHoldId), 'other key');

    clearConfirmedCheckoutStorage(storage, eventSessionId, holdId);

    assert.equal(entries.has(holdStorageKey(eventSessionId)), false);
    assert.equal(entries.has(bookingKeyStorageKey(eventSessionId, holdId)), false);
    assert.equal(entries.get(bookingKeyStorageKey(eventSessionId, otherHoldId)), 'other key');
  });
});
