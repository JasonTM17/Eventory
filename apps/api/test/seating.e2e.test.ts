import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/infrastructure/database/prisma.service.js';
import { AppModule } from '../src/app.module.js';

function cookiePair(headers: string | string[] | undefined, name: string): string {
  const values = Array.isArray(headers) ? headers : headers ? [headers] : [];
  const value = values.find((header) => header.startsWith(`${name}=`));
  assert.ok(value, `Expected ${name} cookie`);
  return value.split(';', 1)[0] as string;
}

describe('seat reservation', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerCookie: string;
  let attendeeCookie: string;
  let eventSessionId: string;
  let firstSeatId: string;
  let secondSeatId: string;
  let ownerHoldToken: string;
  const ownerEmail = `seating-owner-${Date.now()}@example.com`;
  const attendeeEmail = `seating-attendee-${Date.now()}@example.com`;

  before(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);

    const owner = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: ownerEmail, displayName: 'Seating Owner', password: 'StrongPassword9' })
      .expect(201);
    ownerCookie = cookiePair(owner.headers['set-cookie'], 'eventory_access');
    const attendee = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: attendeeEmail, displayName: 'Seating Attendee', password: 'StrongPassword9' })
      .expect(201);
    attendeeCookie = cookiePair(attendee.headers['set-cookie'], 'eventory_access');

    const organization = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Cookie', ownerCookie)
      .send({ name: `Seating Lab ${Date.now()}` })
      .expect(201);
    const organizationId = organization.body.id as string;
    const venue = await request(app.getHttpServer())
      .post('/api/v1/organizer/venues')
      .set('Cookie', ownerCookie)
      .send({ organizationId, name: `Reservation Hall ${Date.now()}` })
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
        organizationId,
        venueId: venue.body.id,
        name: `Seat Event ${Date.now()}`,
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
    await request(app.getHttpServer())
      .post(`/api/v1/organizer/events/${eventId}/ticket-types`)
      .set('Cookie', ownerCookie)
      .send({ name: 'General', priceMinor: 100_000, capacity: 2 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/organizer/events/${eventId}/publish`)
      .set('Cookie', ownerCookie)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/organizer/events/${eventId}/open-sales`)
      .set('Cookie', ownerCookie)
      .expect(201);

    const ticketType = await prisma.ticketType.findFirstOrThrow({ where: { eventId } });
    await prisma.seatAllocation.createMany({
      data: [
        { eventSessionId, seatId: firstSeatId, ticketTypeId: ticketType.id },
        { eventSessionId, seatId: secondSeatId, ticketTypeId: ticketType.id },
      ],
    });
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, attendeeEmail] } } });
    await app.close();
  });

  it('holds seats atomically and prevents a second user from taking the same seat', async () => {
    const initial = await request(app.getHttpServer())
      .get(`/api/v1/seating/${eventSessionId}/availability`)
      .expect(200);
    assert.equal(initial.body.seats.length, 2);

    const held = await request(app.getHttpServer())
      .post(`/api/v1/seating/${eventSessionId}/holds`)
      .set('Cookie', ownerCookie)
      .send({ seatIds: [firstSeatId], idempotencyKey: 'hold-one' })
      .expect(200);
    assert.equal(held.body.seatIds[0], firstSeatId);
    ownerHoldToken = held.body.holdToken as string;

    const duplicate = await request(app.getHttpServer())
      .post(`/api/v1/seating/${eventSessionId}/holds`)
      .set('Cookie', attendeeCookie)
      .send({ seatIds: [firstSeatId] })
      .expect(409);
    assert.equal(duplicate.body.code, 'SEAT_ALREADY_HELD');

    const idempotent = await request(app.getHttpServer())
      .post(`/api/v1/seating/${eventSessionId}/holds`)
      .set('Cookie', ownerCookie)
      .send({ seatIds: [firstSeatId], idempotencyKey: 'hold-one' })
      .expect(200);
    assert.equal(idempotent.body.holdToken, held.body.holdToken);
  });

  it('fails multi-seat holds atomically and enforces ownership on release', async () => {
    const partial = await request(app.getHttpServer())
      .post(`/api/v1/seating/${eventSessionId}/holds`)
      .set('Cookie', attendeeCookie)
      .send({ seatIds: [firstSeatId, secondSeatId] })
      .expect(409);
    assert.equal(partial.body.code, 'SEAT_ALREADY_HELD');

    const wrongOwner = await request(app.getHttpServer())
      .delete(`/api/v1/seating/${eventSessionId}/holds`)
      .set('Cookie', attendeeCookie)
      .send({ seatIds: [firstSeatId], holdToken: 'not-the-token' })
      .expect(403);
    assert.equal(wrongOwner.body.code, 'HOLD_NOT_OWNED');

    const released = await request(app.getHttpServer())
      .delete(`/api/v1/seating/${eventSessionId}/holds`)
      .set('Cookie', ownerCookie)
      .send({ seatIds: [firstSeatId], holdToken: ownerHoldToken })
      .expect(200);
    assert.equal(released.body.released, true);

    const repeated = await request(app.getHttpServer())
      .delete(`/api/v1/seating/${eventSessionId}/holds`)
      .set('Cookie', ownerCookie)
      .send({ seatIds: [firstSeatId], holdToken: ownerHoldToken })
      .expect(200);
    assert.equal(repeated.body.released, false);
  });

  it('allows exactly one winner when two users race for the same seat', async () => {
    const responses = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/seating/${eventSessionId}/holds`)
        .set('Cookie', ownerCookie)
        .send({ seatIds: [secondSeatId] }),
      request(app.getHttpServer())
        .post(`/api/v1/seating/${eventSessionId}/holds`)
        .set('Cookie', attendeeCookie)
        .send({ seatIds: [secondSeatId] }),
    ]);
    assert.deepEqual(
      responses.map((response) => response.status).sort((left, right) => left - right),
      [200, 409],
    );
  });
});
