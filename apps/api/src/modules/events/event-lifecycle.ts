import { ConflictException } from '@nestjs/common';
import { EventStatus } from '../../generated/prisma/client.js';

const transitions: Record<EventStatus, readonly EventStatus[]> = {
  [EventStatus.DRAFT]: [EventStatus.PUBLISHED, EventStatus.CANCELLED],
  [EventStatus.PUBLISHED]: [EventStatus.SALES_OPEN, EventStatus.CANCELLED],
  [EventStatus.SALES_OPEN]: [EventStatus.SALES_CLOSED, EventStatus.CANCELLED],
  [EventStatus.SALES_CLOSED]: [EventStatus.ONGOING, EventStatus.CANCELLED],
  [EventStatus.ONGOING]: [EventStatus.COMPLETED, EventStatus.CANCELLED],
  [EventStatus.COMPLETED]: [],
  [EventStatus.CANCELLED]: [],
};

export function assertEventTransition(from: EventStatus, to: EventStatus): void {
  if (!transitions[from].includes(to)) {
    throw new ConflictException({
      code: 'EVENT_INVALID_TRANSITION',
      message: `Event cannot transition from ${from} to ${to}`,
      details: { from, to },
    });
  }
}
