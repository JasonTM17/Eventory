import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SeatAvailability } from '@eventory/contracts';
import { groupSeatsByRow, hasAisleAfter } from './seat-map-layout';

function seat(rowLabel: string, seatNumber: number): SeatAvailability {
  return {
    seatId: `${rowLabel}-${seatNumber}`,
    sectionId: 'auditorium',
    sectionName: 'Main Floor',
    rowLabel,
    seatNumber,
    code: `${rowLabel}-${seatNumber}`,
    status: 'available',
    holdExpiresAt: null,
    ticketTypeId: 'standard',
  };
}

describe('cinema seat map layout', () => {
  it('orders rows and seat numbers for a stable auditorium layout', () => {
    const rows = groupSeatsByRow([seat('B', 2), seat('A', 10), seat('A', 2), seat('B', 1)]);

    assert.deepEqual(
      rows.map((row) => [row.label, row.seats.map((item) => item.seatNumber)]),
      [
        ['A', [2, 10]],
        ['B', [1, 2]],
      ],
    );
  });

  it('creates two balanced aisles in a fourteen-seat row', () => {
    assert.deepEqual(
      Array.from({ length: 14 }, (_, index) => index + 1).filter(hasAisleAfter),
      [4, 10],
    );
  });
});
