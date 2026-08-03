import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/infrastructure/database/prisma.service.js';
import { MockPaymentProvider } from '../src/modules/payments/payment-provider.js';
import { RedisService } from '../src/infrastructure/redis/redis.service.js';

function cookiePair(headers: string | string[] | undefined, name: string): string {
  const values = Array.isArray(headers) ? headers : headers ? [headers] : [];
  const value = values.find((header) => header.startsWith(`${name}=`));
  assert.ok(value, `Expected ${name} cookie`);
  return value.split(';', 1)[0] as string;
}

describe('booking and payment', { concurrency: false }, () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let provider: MockPaymentProvider;
  let attendeeCookie: string;
  let eventSessionId: string;
  let firstSeatId: string;
  let secondSeatId: string;
  let thirdSeatId: string;
  let ticketTypeId: string;
  let concurrentBookingId: string;
  const attendeeEmail = `booking-attendee-${Date.now()}@example.com`;

  before(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    provider = app.get(MockPaymentProvider);

    const owner = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({
        email: `booking-owner-${Date.now()}@example.com`,
        displayName: 'Booking Owner',
        password: 'StrongPassword9',
      })
      .expect(201);
    const ownerCookie = cookiePair(owner.headers['set-cookie'], 'eventory_access');
    const attendee = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({ email: attendeeEmail, displayName: 'Booking Attendee', password: 'StrongPassword9' })
      .expect(201);
    attendeeCookie = cookiePair(attendee.headers['set-cookie'], 'eventory_access');

    const organization = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Cookie', ownerCookie)
      .send({ name: `Booking Lab ${Date.now()}` })
      .expect(201);
    const venue = await request(app.getHttpServer())
      .post('/api/v1/organizer/venues')
      .set('Cookie', ownerCookie)
      .send({ organizationId: organization.body.id, name: `Checkout Hall ${Date.now()}` })
      .expect(201);
    const section = await request(app.getHttpServer())
      .post(`/api/v1/organizer/venues/${venue.body.id}/sections`)
      .set('Cookie', ownerCookie)
      .send({ name: 'Main Floor' })
      .expect(201);
    const firstSeat = await request(app.getHttpServer())
      .post(`/api/v1/organizer/venues/sections/${section.body.id}/seats`)
      .set('Cookie', ownerCookie)
      .send({ rowLabel: 'A', seatNumber: 1 })
      .expect(201);
    const secondSeat = await request(app.getHttpServer())
      .post(`/api/v1/organizer/venues/sections/${section.body.id}/seats`)
      .set('Cookie', ownerCookie)
      .send({ rowLabel: 'A', seatNumber: 2 })
      .expect(201);
    const thirdSeat = await request(app.getHttpServer())
      .post(`/api/v1/organizer/venues/sections/${section.body.id}/seats`)
      .set('Cookie', ownerCookie)
      .send({ rowLabel: 'A', seatNumber: 3 })
      .expect(201);
    firstSeatId = firstSeat.body.id as string;
    secondSeatId = secondSeat.body.id as string;
    thirdSeatId = thirdSeat.body.id as string;

    const event = await request(app.getHttpServer())
      .post('/api/v1/organizer/events')
      .set('Cookie', ownerCookie)
      .send({
        organizationId: organization.body.id,
        venueId: venue.body.id,
        name: `Checkout Event ${Date.now()}`,
        startAt: new Date(Date.now() + 86_400_000).toISOString(),
        endAt: new Date(Date.now() + 90_000_000).toISOString(),
      })
      .expect(201);
    const eventId = event.body.id as string;
    const session = await request(app.getHttpServer())
      .post(`/api/v1/organizer/events/${eventId}/sessions`)
      .set('Cookie', ownerCookie)
      .send({
        name: 'Main session',
        startAt: new Date(Date.now() + 86_400_000).toISOString(),
        endAt: new Date(Date.now() + 90_000_000).toISOString(),
        salesStartAt: new Date(Date.now() - 3_600_000).toISOString(),
        salesEndAt: new Date(Date.now() + 80_000_000).toISOString(),
      })
      .expect(201);
    eventSessionId = session.body.id as string;
    const ticketType = await request(app.getHttpServer())
      .post(`/api/v1/organizer/events/${eventId}/ticket-types`)
      .set('Cookie', ownerCookie)
      .send({ name: 'General', priceMinor: 100_000, capacity: 3 })
      .expect(201);
    ticketTypeId = ticketType.body.id as string;
    await request(app.getHttpServer())
      .post(`/api/v1/organizer/events/${eventId}/publish`)
      .set('Cookie', ownerCookie)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/organizer/events/${eventId}/open-sales`)
      .set('Cookie', ownerCookie)
      .expect(201);
    await prisma.seatAllocation.createMany({
      data: [
        { eventSessionId, seatId: firstSeatId, ticketTypeId },
        { eventSessionId, seatId: secondSeatId, ticketTypeId },
        { eventSessionId, seatId: thirdSeatId, ticketTypeId },
      ],
    });
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: 'booking-' } } });
    await app.close();
  });

  it('calculates totals from snapshots and confirms duplicate webhooks idempotently', async () => {
    const held = await request(app.getHttpServer())
      .post(`/api/v1/seating/${eventSessionId}/holds`)
      .set('Cookie', attendeeCookie)
      .send({ seatIds: [firstSeatId], idempotencyKey: `booking-hold-${Date.now()}` })
      .expect(200);
    const idempotencyKey = `booking-${Date.now()}`;
    const booking = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', attendeeCookie)
      .send({
        eventSessionId,
        seatIds: [firstSeatId],
        holdToken: held.body.holdToken,
        idempotencyKey,
        clientTotalMinor: 1,
      })
      .expect(201);
    assert.equal(booking.body.totalMinor, 100_000);
    assert.equal(booking.body.status, 'PENDING');

    const duplicate = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', attendeeCookie)
      .send({
        eventSessionId,
        seatIds: [firstSeatId],
        holdToken: held.body.holdToken,
        idempotencyKey,
        clientTotalMinor: 1,
      });
    assert.equal(duplicate.status, 201);
    assert.equal(duplicate.body.id, booking.body.id);

    const mismatchedReplay = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', attendeeCookie)
      .send({
        eventSessionId,
        seatIds: [firstSeatId],
        holdToken: held.body.holdToken,
        idempotencyKey,
        clientTotalMinor: 999,
      });
    assert.equal(mismatchedReplay.status, 409);
    assert.equal(mismatchedReplay.body.code, 'IDEMPOTENCY_KEY_REUSED');

    const payload = {
      id: randomUUID(),
      type: 'payment.succeeded' as const,
      reference: booking.body.payment.providerReference as string,
      amountMinor: 100_000,
      currency: 'VND',
    };
    const confirmed = await request(app.getHttpServer())
      .post('/api/v1/payments/webhooks/mock')
      .set('x-mock-payment-signature', provider.signPayload(payload))
      .send(payload);
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    assert.equal(confirmed.body.status, 'CONFIRMED');

    const repeated = await request(app.getHttpServer())
      .post('/api/v1/payments/webhooks/mock')
      .set('x-mock-payment-signature', provider.signPayload(payload))
      .send(payload)
      .expect(200);
    assert.equal(repeated.body.status, 'CONFIRMED');
    assert.equal(await prisma.ticket.count({ where: { bookingId: booking.body.id } }), 1);
    assert.equal(await prisma.outboxEvent.count({ where: { bookingId: booking.body.id } }), 2);
    assert.equal(
      (
        await prisma.seatAllocation.findUniqueOrThrow({
          where: { eventSessionId_seatId: { eventSessionId, seatId: firstSeatId } },
        })
      ).status,
      'SOLD',
    );

    const lateFailure = {
      ...payload,
      id: randomUUID(),
      type: 'payment.failed' as const,
    };
    const stable = await request(app.getHttpServer())
      .post('/api/v1/payments/webhooks/mock')
      .set('x-mock-payment-signature', provider.signPayload(lateFailure))
      .send(lateFailure)
      .expect(200);
    assert.equal(stable.body.status, 'CONFIRMED');
    assert.equal(stable.body.payment.status, 'SUCCEEDED');
    assert.equal(
      (
        await prisma.paymentEvent.findUniqueOrThrow({
          where: {
            provider_providerEventId: { provider: 'MOCK', providerEventId: lateFailure.id },
          },
        })
      ).status,
      'IGNORED',
    );
  });

  it('rejects amount tampering and rolls back when capacity is exceeded', async () => {
    const held = await request(app.getHttpServer())
      .post(`/api/v1/seating/${eventSessionId}/holds`)
      .set('Cookie', attendeeCookie)
      .send({ seatIds: [secondSeatId], idempotencyKey: `booking-hold-${Date.now()}` })
      .expect(200);
    const booking = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', attendeeCookie)
      .send({ eventSessionId, seatIds: [secondSeatId], holdToken: held.body.holdToken })
      .expect(201);
    const bookingPayment = await prisma.payment.findUniqueOrThrow({
      where: { bookingId: booking.body.id as string },
    });
    const tampered = {
      id: randomUUID(),
      type: 'payment.succeeded' as const,
      reference: booking.body.payment.providerReference as string,
      amountMinor: 1,
      currency: 'VND',
    };
    await request(app.getHttpServer())
      .post('/api/v1/payments/webhooks/mock')
      .set('x-mock-payment-signature', provider.signPayload(tampered))
      .send(tampered)
      .expect(409);

    await prisma.ticketType.update({ where: { id: ticketTypeId }, data: { capacity: 1 } });
    const success = {
      ...tampered,
      id: randomUUID(),
      amountMinor: 100_000,
    };
    const reconciled = await request(app.getHttpServer())
      .post('/api/v1/payments/webhooks/mock')
      .set('x-mock-payment-signature', provider.signPayload(success))
      .send(success)
      .expect(200);
    assert.equal(reconciled.body.status, 'EXPIRED');
    assert.equal(reconciled.body.payment.status, 'REQUIRES_RECONCILIATION');
    assert.equal(await prisma.ticket.count({ where: { bookingId: booking.body.id } }), 0);
    assert.equal(
      await prisma.paymentReconciliation.count({
        where: { paymentId: bookingPayment.id },
      }),
      1,
    );
    assert.equal(
      (
        await prisma.seatAllocation.findUniqueOrThrow({
          where: { eventSessionId_seatId: { eventSessionId, seatId: secondSeatId } },
        })
      ).status,
      'AVAILABLE',
    );
    await prisma.ticketType.update({ where: { id: ticketTypeId }, data: { capacity: 3 } });
    await redis.delete([`eventory:seat-hold:${eventSessionId}:${secondSeatId}`]);
  });

  it('does not sell a seat after its hold is removed before payment confirmation', async () => {
    const held = await request(app.getHttpServer())
      .post(`/api/v1/seating/${eventSessionId}/holds`)
      .set('Cookie', attendeeCookie)
      .send({ seatIds: [secondSeatId], idempotencyKey: `booking-hold-${Date.now()}` })
      .expect(200);
    const booking = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', attendeeCookie)
      .send({ eventSessionId, seatIds: [secondSeatId], holdToken: held.body.holdToken })
      .expect(201);
    await redis.delete([`eventory:seat-hold:${eventSessionId}:${secondSeatId}`]);
    const payload = {
      id: randomUUID(),
      type: 'payment.succeeded' as const,
      reference: booking.body.payment.providerReference as string,
      amountMinor: 100_000,
      currency: 'VND',
    };
    const late = await request(app.getHttpServer())
      .post('/api/v1/payments/webhooks/mock')
      .set('x-mock-payment-signature', provider.signPayload(payload))
      .send(payload)
      .expect(200);
    assert.equal(late.body.status, 'EXPIRED');
    assert.equal(late.body.payment.status, 'REQUIRES_RECONCILIATION');
    assert.equal(await prisma.ticket.count({ where: { bookingId: booking.body.id } }), 0);
  });

  it('coalesces concurrent checkout requests without a client idempotency key', async () => {
    const held = await request(app.getHttpServer())
      .post(`/api/v1/seating/${eventSessionId}/holds`)
      .set('Cookie', attendeeCookie)
      .send({ seatIds: [thirdSeatId], idempotencyKey: `booking-hold-${Date.now()}` })
      .expect(200);
    const body = {
      eventSessionId,
      seatIds: [thirdSeatId],
      holdToken: held.body.holdToken as string,
    };
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Cookie', attendeeCookie)
        .send(body),
      request(app.getHttpServer())
        .post('/api/v1/bookings')
        .set('Cookie', attendeeCookie)
        .send(body),
    ]);
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.equal(second.status, 201, JSON.stringify(second.body));
    assert.equal(first.body.id, second.body.id);
    assert.equal(first.body.payment.providerReference, second.body.payment.providerReference);
    concurrentBookingId = first.body.id as string;
    assert.equal(await prisma.booking.count({ where: { holdId: held.body.holdId as string } }), 1);
    assert.equal(await prisma.payment.count({ where: { bookingId: concurrentBookingId } }), 1);
  });

  it('records a late capture for manual reconciliation and acknowledges retries', async () => {
    assert.ok(concurrentBookingId);
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: concurrentBookingId },
      include: { payment: true },
    });
    const payload = {
      id: randomUUID(),
      type: 'payment.succeeded' as const,
      reference: booking.payment?.providerReference as string,
      amountMinor: booking.totalMinor,
      currency: booking.currency,
    };
    await prisma.booking.update({
      where: { id: booking.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await redis.delete([`eventory:seat-hold:${eventSessionId}:${thirdSeatId}`]);

    const late = await request(app.getHttpServer())
      .post('/api/v1/payments/webhooks/mock')
      .set('x-mock-payment-signature', provider.signPayload(payload))
      .send(payload)
      .expect(200);
    assert.equal(late.body.status, 'EXPIRED');
    assert.equal(late.body.payment.status, 'REQUIRES_RECONCILIATION');
    assert.equal(await prisma.ticket.count({ where: { bookingId: booking.id } }), 0);
    const paymentId = booking.payment?.id;
    assert.ok(paymentId);
    assert.equal(await prisma.paymentReconciliation.count({ where: { paymentId } }), 1);
    assert.equal(
      (
        await prisma.paymentEvent.findUniqueOrThrow({
          where: { provider_providerEventId: { provider: 'MOCK', providerEventId: payload.id } },
        })
      ).status,
      'PROCESSED',
    );

    const repeated = await request(app.getHttpServer())
      .post('/api/v1/payments/webhooks/mock')
      .set('x-mock-payment-signature', provider.signPayload(payload))
      .send(payload)
      .expect(200);
    assert.equal(repeated.body.status, 'EXPIRED');
    assert.equal(repeated.body.payment.status, 'REQUIRES_RECONCILIATION');
    assert.equal(await prisma.paymentReconciliation.count({ where: { paymentId } }), 1);
  });

  it('reuses the durable provider identity after an initialization crash', async () => {
    const held = await request(app.getHttpServer())
      .post(`/api/v1/seating/${eventSessionId}/holds`)
      .set('Cookie', attendeeCookie)
      .send({ seatIds: [thirdSeatId], idempotencyKey: `booking-hold-${Date.now()}` })
      .expect(200);
    const booking = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Cookie', attendeeCookie)
      .send({ eventSessionId, seatIds: [thirdSeatId], holdToken: held.body.holdToken })
      .expect(201);
    const originalReference = booking.body.payment.providerReference as string;
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { bookingId: booking.body.id },
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerReference: null,
        clientSecret: null,
        status: 'PROCESSING',
        providerAttemptedAt: new Date(Date.now() - 60_000),
      },
    });

    const recovered = await request(app.getHttpServer())
      .get(`/api/v1/bookings/${booking.body.id}`)
      .set('Cookie', attendeeCookie)
      .expect(200);
    assert.equal(recovered.body.payment.providerReference, originalReference);
    assert.equal(
      (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .providerIdempotencyKey,
      `booking:${booking.body.id}`,
    );
  });
});
