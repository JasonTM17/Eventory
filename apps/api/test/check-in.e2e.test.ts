import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/infrastructure/database/prisma.service.js';

function cookiePair(headers: string | string[] | undefined, name: string): string {
  const values = Array.isArray(headers) ? headers : headers ? [headers] : [];
  const value = values.find((header) => header.startsWith(`${name}=`));
  assert.ok(value, `Expected ${name} cookie`);
  return value.split(';', 1)[0] as string;
}

describe('tickets and organizer check-in', { concurrency: false }, () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerCookie: string;
  let attendeeCookie: string;
  let outsiderCookie: string;
  let attendeeId: string;
  let organizationId: string;
  let eventId: string;
  let eventSessionId: string;
  let seatAllocationId: string;
  let seatId: string;
  let ticketTypeId: string;
  const runId = Date.now();

  before(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);

    const owner = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `checkin-owner-${runId}@example.com`,
        displayName: 'Check-in Owner',
        password: 'StrongPassword9',
      })
      .expect(201);
    ownerCookie = cookiePair(owner.headers['set-cookie'], 'eventory_access');

    const attendee = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `checkin-attendee-${runId}@example.com`,
        displayName: 'Check-in Attendee',
        password: 'StrongPassword9',
      })
      .expect(201);
    attendeeCookie = cookiePair(attendee.headers['set-cookie'], 'eventory_access');
    attendeeId = attendee.body.user.id as string;

    const outsider = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `checkin-outsider-${runId}@example.com`,
        displayName: 'Check-in Outsider',
        password: 'StrongPassword9',
      })
      .expect(201);
    outsiderCookie = cookiePair(outsider.headers['set-cookie'], 'eventory_access');

    const organization = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Cookie', ownerCookie)
      .send({ name: `Checkin Lab ${runId}` })
      .expect(201);
    organizationId = organization.body.id as string;

    const venue = await prisma.venue.create({
      data: { organizationId, name: `Checkin Hall ${runId}` },
    });
    const section = await prisma.venueSection.create({
      data: { venueId: venue.id, name: 'Main Floor' },
    });
    const seat = await prisma.seat.create({
      data: {
        venueId: venue.id,
        sectionId: section.id,
        rowLabel: 'A',
        seatNumber: 1,
        code: `A-${runId}`,
      },
    });
    seatId = seat.id;

    const event = await prisma.event.create({
      data: {
        organizationId,
        venueId: venue.id,
        name: `Checkin Event ${runId}`,
        slug: `checkin-event-${runId}`,
        timezone: 'UTC',
        startAt: new Date(Date.now() + 86_400_000),
        endAt: new Date(Date.now() + 90_000_000),
        status: 'SALES_OPEN',
      },
    });
    eventId = event.id;
    const session = await prisma.eventSession.create({
      data: {
        eventId,
        name: 'Main session',
        startAt: event.startAt,
        endAt: event.endAt,
        salesStartAt: new Date(Date.now() - 3_600_000),
        salesEndAt: new Date(Date.now() + 80_000_000),
      },
    });
    eventSessionId = session.id;
    const ticketType = await prisma.ticketType.create({
      data: {
        eventId,
        name: 'General admission',
        priceMinor: 100_000,
        capacity: 100,
      },
    });
    ticketTypeId = ticketType.id;
    const allocation = await prisma.seatAllocation.create({
      data: { eventSessionId, seatId, ticketTypeId },
    });
    seatAllocationId = allocation.id;
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'checkin-' } } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await app.close();
  });

  async function createTicket(status: 'ISSUED' | 'REFUNDED' = 'ISSUED'): Promise<string> {
    const booking = await prisma.booking.create({
      data: {
        publicCode: `EVT-${randomBytes(8).toString('hex').toUpperCase()}`,
        userId: attendeeId,
        eventSessionId,
        holdId: randomUUID(),
        status: 'CONFIRMED',
        currency: 'VND',
        subtotalMinor: 100_000,
        totalMinor: 100_000,
        expiresAt: new Date(Date.now() + 600_000),
      },
    });
    const item = await prisma.bookingItem.create({
      data: {
        bookingId: booking.id,
        seatAllocationId,
        seatId,
        ticketTypeId,
        ticketTypeName: 'General admission',
        seatCode: `A-${runId}`,
        priceMinor: 100_000,
        currency: 'VND',
      },
    });
    const ticket = await prisma.ticket.create({
      data: {
        bookingId: booking.id,
        bookingItemId: item.id,
        userId: attendeeId,
        eventSessionId,
        publicCode: `TKT-${randomBytes(8).toString('hex').toUpperCase()}`,
        qrNonce: randomBytes(24).toString('base64url'),
        status,
      },
    });
    return ticket.publicCode;
  }

  async function ticketPayload(publicCode: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${publicCode}`)
      .set('Cookie', attendeeCookie);
    assert.equal(response.status, 200);
    return response.body.qrPayload as string;
  }

  it('returns a wallet ticket with an opaque signed QR payload', async () => {
    const publicCode = await createTicket();
    const response = await request(app.getHttpServer())
      .get('/api/v1/tickets')
      .set('Cookie', attendeeCookie)
      .expect(200);
    const ticket = response.body.find(
      (item: { publicCode: string }) => item.publicCode === publicCode,
    );
    assert.ok(ticket);
    assert.equal(ticket.status, 'ISSUED');
    assert.match(ticket.qrPayload, /^evtqr\.1\.1\./);
    assert.ok(!ticket.qrPayload.includes(eventSessionId));
  });

  it('rejects forged QR input and organizers from another organization', async () => {
    const payload = await ticketPayload(await createTicket());
    const forged = `${payload.slice(0, -1)}${payload.endsWith('A') ? 'B' : 'A'}`;
    const invalid = await request(app.getHttpServer())
      .post('/api/v1/check-in')
      .set('Cookie', ownerCookie)
      .send({ qrPayload: forged })
      .expect(400);
    assert.equal(invalid.body.code, 'INVALID_QR_SIGNATURE');

    const denied = await request(app.getHttpServer())
      .post('/api/v1/check-in')
      .set('Cookie', outsiderCookie)
      .send({ qrPayload: payload })
      .expect(403);
    assert.equal(denied.body.code, 'ORGANIZATION_ACCESS_DENIED');
    assert.equal(await prisma.ticketCheckIn.count(), 0);
  });

  it('allows exactly one successful concurrent scan and reports duplicates', async () => {
    const payload = await ticketPayload(await createTicket());
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(app.getHttpServer())
          .post('/api/v1/check-in')
          .set('Cookie', ownerCookie)
          .send({ qrPayload: payload }),
      ),
    );
    assert.equal(responses.filter((response) => response.status === 200).length, 8);
    assert.equal(responses.filter((response) => response.body.result === 'VALID').length, 1);
    assert.equal(
      responses.filter((response) => response.body.result === 'ALREADY_CHECKED_IN').length,
      7,
    );
    assert.equal(await prisma.ticketCheckIn.count(), 1);
  });

  it('rejects a selected-session mismatch and non-active ticket states', async () => {
    const wrongSessionPayload = await ticketPayload(await createTicket());
    const wrongSession = await request(app.getHttpServer())
      .post('/api/v1/check-in')
      .set('Cookie', ownerCookie)
      .send({ qrPayload: wrongSessionPayload, eventSessionId: randomUUID() })
      .expect(409);
    assert.equal(wrongSession.body.code, 'WRONG_EVENT');

    const refunded = await request(app.getHttpServer())
      .post('/api/v1/check-in')
      .set('Cookie', ownerCookie)
      .send({ qrPayload: await ticketPayload(await createTicket('REFUNDED')) })
      .expect(200);
    assert.equal(refunded.body.result, 'TICKET_REFUNDED');

    const cancelledCode = await createTicket();
    await prisma.event.update({ where: { id: eventId }, data: { status: 'CANCELLED' } });
    const cancelled = await request(app.getHttpServer())
      .post('/api/v1/check-in')
      .set('Cookie', ownerCookie)
      .send({ qrPayload: await ticketPayload(cancelledCode) })
      .expect(200);
    assert.equal(cancelled.body.result, 'EVENT_CANCELLED');
  });
});
