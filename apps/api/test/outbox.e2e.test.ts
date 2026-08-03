import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/infrastructure/database/prisma.service.js';
import { OutboxService } from '../src/modules/outbox/outbox.service.js';

process.env.OUTBOX_WORKER_ENABLED = 'false';

describe('transactional outbox', { concurrency: false }, () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let outbox: OutboxService;
  let userId: string;
  let organizationId: string;
  let bookingId: string;

  before(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);
    outbox = app.get(OutboxService);

    const user = await prisma.user.create({
      data: {
        email: `outbox-${Date.now()}@example.com`,
        displayName: 'Outbox Recipient',
        passwordHash: 'test-only-hash',
      },
    });
    userId = user.id;
    const organization = await prisma.organization.create({
      data: { name: `Outbox Lab ${Date.now()}`, slug: `outbox-${Date.now()}`, ownerId: user.id },
    });
    organizationId = organization.id;
    const event = await prisma.event.create({
      data: {
        organizationId,
        name: 'Outbox Event',
        slug: `outbox-event-${Date.now()}`,
        timezone: 'UTC',
        startAt: new Date(Date.now() + 86_400_000),
        endAt: new Date(Date.now() + 90_000_000),
        status: 'SALES_OPEN',
      },
    });
    const session = await prisma.eventSession.create({
      data: {
        eventId: event.id,
        name: 'Main session',
        startAt: event.startAt,
        endAt: event.endAt,
        salesStartAt: new Date(Date.now() - 3_600_000),
        salesEndAt: new Date(Date.now() + 80_000_000),
      },
    });
    const booking = await prisma.booking.create({
      data: {
        publicCode: `EVT-${randomUUID().slice(0, 8).toUpperCase()}`,
        userId: user.id,
        eventSessionId: session.id,
        holdId: randomUUID(),
        status: 'CONFIRMED',
        currency: 'VND',
        subtotalMinor: 100_000,
        totalMinor: 100_000,
        expiresAt: new Date(Date.now() + 600_000),
      },
    });
    bookingId = booking.id;
  });

  after(async () => {
    await prisma.user.delete({ where: { id: userId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await app.close();
  });

  it('claims once, sends a deduplicated email, and marks the outbox event processed', async () => {
    const event = await prisma.outboxEvent.create({
      data: {
        topic: 'booking.confirmed',
        aggregateType: 'Booking',
        aggregateId: bookingId,
        bookingId,
        payload: { bookingId },
      },
    });
    const [first, second] = await Promise.all([outbox.processOnce(), outbox.processOnce()]);
    assert.equal(first + second, 1);
    assert.equal(
      (await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).status,
      'PROCESSED',
    );
    assert.equal(
      await prisma.notificationDelivery.count({
        where: { dedupeKey: `booking.confirmed:${bookingId}:EMAIL` },
      }),
      1,
    );
    assert.equal(
      (
        await prisma.notificationDelivery.findUniqueOrThrow({
          where: { dedupeKey: `booking.confirmed:${bookingId}:EMAIL` },
        })
      ).status,
      'SENT',
    );

    assert.equal(await outbox.processOnce(), 0);
    assert.equal(await prisma.notificationDelivery.count({ where: { bookingId } }), 1);
  });

  it('moves a repeatedly failing event to the dead-letter state', async () => {
    const event = await prisma.outboxEvent.create({
      data: {
        topic: 'booking.confirmed',
        aggregateType: 'Booking',
        aggregateId: randomUUID(),
        attempts: 4,
        nextAttemptAt: new Date(Date.now() - 1_000),
        payload: { reason: 'missing booking' },
      },
    });
    assert.equal(await outbox.processOnce(), 1);
    const failed = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    assert.equal(failed.status, 'DEAD');
    assert.match(failed.lastError ?? '', /booking aggregate/i);
  });
});
