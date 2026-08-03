export function holdStorageKey(eventSessionId: string): string {
  return `eventory:seat-hold:${eventSessionId}`;
}

export function bookingKeyStorageKey(eventSessionId: string, holdId: string): string {
  return `eventory:booking-key:${eventSessionId}:${holdId}`;
}

export function clearConfirmedCheckoutStorage(
  storage: Pick<Storage, 'removeItem'>,
  eventSessionId: string,
  holdId: string,
): void {
  storage.removeItem(holdStorageKey(eventSessionId));
  storage.removeItem(bookingKeyStorageKey(eventSessionId, holdId));
}
