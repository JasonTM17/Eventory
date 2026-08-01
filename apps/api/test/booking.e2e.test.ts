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
  let ticketTypeId: string;
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
    firstSeatId = firstSeat.body.id as string;
    secondSeatId = secondSeat.body.id as string;

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
      .send({ name: 'General', priceMinor: 100_000, capacity: 2 })
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
        clientTotalMinor: 999,
      });
    assert.equal(duplicate.status, 201);
    assert.equal(duplicate.body.id, booking.body.id);

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
    assert.equal(await prisma.outboxEvent.count({ where: { bookingId: booking.body.id } }), 1);
    assert.equal(
      (
        await prisma.seatAllocation.findUniqueOrThrow({
          where: { eventSessionId_seatId: { eventSessionId, seatId: firstSeatId } },
        })
      ).status,
      'SOLD',
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
    const rolledBack = await request(app.getHttpServer())
      .post('/api/v1/payments/webhooks/mock')
      .set('x-mock-payment-signature', provider.signPayload(success))
      .send(success)
      .expect(409);
    assert.equal(rolledBack.body.code, 'TICKET_CAPACITY_REACHED');
    assert.equal(await prisma.ticket.count({ where: { bookingId: booking.body.id } }), 0);
    assert.equal(
      (
        await prisma.seatAllocation.findUniqueOrThrow({
          where: { eventSessionId_seatId: { eventSessionId, seatId: secondSeatId } },
        })
      ).status,
      'AVAILABLE',
    );
    await prisma.ticketType.update({ where: { id: ticketTypeId }, data: { capacity: 2 } });
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
    await request(app.getHttpServer())
      .post('/api/v1/payments/webhooks/mock')
      .set('x-mock-payment-signature', provider.signPayload(payload))
      .send(payload)
      .expect(409);
    assert.equal(await prisma.ticket.count({ where: { bookingId: booking.body.id } }), 0);
  });
});
