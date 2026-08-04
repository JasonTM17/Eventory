import type { SeatAvailability } from '@eventory/contracts';

export interface SeatRow {
  label: string;
  seats: SeatAvailability[];
}

export function groupSeatsByRow(seats: SeatAvailability[]): SeatRow[] {
  const grouped = new Map<string, SeatAvailability[]>();
  for (const seat of seats) {
    grouped.set(seat.rowLabel, [...(grouped.get(seat.rowLabel) ?? []), seat]);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }))
    .map(([label, rowSeats]) => ({
      label,
      seats: [...rowSeats].sort((left, right) => left.seatNumber - right.seatNumber),
    }));
}

export function hasAisleAfter(seatNumber: number): boolean {
  return seatNumber === 4 || seatNumber === 10;
}
