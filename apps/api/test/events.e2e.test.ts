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

describe('event lifecycle and management', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerCookie: string;
  let foreignCookie: string;
  let organizationId: string;
  let eventId: string;
  let eventSlug: string;
  const ownerEmail = `event-owner-${Date.now()}@example.com`;
  const foreignEmail = `event-foreign-${Date.now()}@example.com`;

  before(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    const owner = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({ email: ownerEmail, displayName: 'Event Owner', password: 'StrongPassword9' })
      .expect(201);
    ownerCookie = cookiePair(owner.headers['set-cookie'], 'eventory_access');

    const organization = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Cookie', ownerCookie)
      .send({ name: `Lifecycle Studio ${ownerEmail.split('@')[0]}` })
      .expect(201);
    organizationId = organization.body.id as string;
    prisma = app.get(PrismaService);

    const foreign = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({ email: foreignEmail, displayName: 'Foreign Organizer', password: 'StrongPassword9' })
      .expect(201);
    foreignCookie = cookiePair(foreign.headers['set-cookie'], 'eventory_access');
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, foreignEmail] } } });
    await app.close();
  });

  it('creates a venue and protects seat identity with database constraints', async () => {
    const venue = await request(app.getHttpServer())
      .post('/api/v1/organizer/venues')
      .set('Cookie', ownerCookie)
      .send({ organizationId, name: 'Lifecycle Hall' })
      .expect(201);
    const section = await request(app.getHttpServer())
      .post(`/api/v1/organizer/venues/${venue.body.id}/sections`)
      .set('Cookie', ownerCookie)
      .send({ name: 'Main Floor' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/organizer/venues/sections/${section.body.id}/seats`)
      .set('Cookie', ownerCookie)
      .send({ rowLabel: 'A', seatNumber: 1 })
      .expect(201);
    const duplicate = await request(app.getHttpServer())
      .post(`/api/v1/organizer/venues/sections/${section.body.id}/seats`)
      .set('Cookie', ownerCookie)
      .send({ rowLabel: 'A', seatNumber: 1 })
      .expect(409);
    assert.equal(duplicate.body.code, 'VENUE_SEAT_EXISTS');
  });

  it('requires session and ticket type prerequisites before publishing', async () => {
    const start = new Date(Date.now() + 86_400_000);
    const end = new Date(start.getTime() + 7_200_000);
    const event = await request(app.getHttpServer())
      .post('/api/v1/organizer/events')
      .set('Cookie', ownerCookie)
      .send({
        organizationId,
        name: 'Lifecycle Concert',
        startAt: start.toISOString(),
        endAt: end.toISOString(),
      })
      .expect(201);
    eventId = event.body.id as string;
    eventSlug = event.body.slug as string;

    const missing = await request(app.getHttpServer())
      .post(`/api/v1/organizer/events/${eventId}/publish`)
      .set('Cookie', ownerCookie)
      .expect(409);
    assert.equal(missing.body.code, 'EVENT_MISSING_INVENTORY');

    const sessionStart = start;
    const sessionEnd = end;
    await request(app.getHttpServer())
      .post(`/api/v1/organizer/events/${eventId}/sessions`)
      .set('Cookie', ownerCookie)
      .send({
        name: 'Opening Session',
        startAt: sessionStart.toISOString(),
        endAt: sessionEnd.toISOString(),
        salesStartAt: new Date(Date.now() - 3_600_000).toISOString(),
        salesEndAt: end.toISOString(),
      })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/api/v1/organizer/events/${eventId}/sessions`)
      .set('Cookie', ownerCookie)
      .send({
        name: 'Opening Session',
        startAt: sessionStart.toISOString(),
        endAt: sessionEnd.toISOString(),
        salesStartAt: new Date(Date.now() - 3_600_000).toISOString(),
        salesEndAt: new Date(start.getTime() - 3_600_000).toISOString(),
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/organizer/events/${eventId}/ticket-types`)
      .set('Cookie', ownerCookie)
      .send({ name: 'Standard', priceMinor: 250_000, capacity: 100 })
      .expect(201);

    const published = await request(app.getHttpServer())
      .post(`/api/v1/organizer/events/${eventId}/publish`)
      .set('Cookie', ownerCookie)
      .expect(201);
    assert.equal(published.body.status, 'PUBLISHED');
  });

  it('enforces lifecycle transitions, public discovery, and ownership', async () => {
    const listed = await request(app.getHttpServer())
      .get('/api/v1/events')
      .query({ search: 'Lifecycle', page: 1, pageSize: 10 })
      .expect(200);
    assert.ok(listed.body.total >= 1);
    assert.ok(listed.body.items.some((item: { slug: string }) => item.slug === eventSlug));

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventSlug}`)
      .expect(200);
    assert.equal(detail.body.status, 'PUBLISHED');

    await request(app.getHttpServer())
      .post(`/api/v1/organizer/events/${eventId}/open-sales`)
      .set('Cookie', ownerCookie)
      .expect(201);
    const immutable = await request(app.getHttpServer())
      .patch(`/api/v1/organizer/events/${eventId}`)
      .set('Cookie', ownerCookie)
      .send({ name: 'Changed After Sales' })
      .expect(409);
    assert.equal(immutable.body.code, 'EVENT_IMMUTABLE_AFTER_SALES');

    const foreign = await request(app.getHttpServer())
      .patch(`/api/v1/organizer/events/${eventId}`)
      .set('Cookie', foreignCookie)
      .send({ name: 'Foreign Edit' })
      .expect(403);
    assert.equal(foreign.body.code, 'ORGANIZATION_ACCESS_DENIED');

    await request(app.getHttpServer())
      .post(`/api/v1/organizer/events/${eventId}/close-sales`)
      .set('Cookie', ownerCookie)
      .expect(201);
    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/organizer/events/${eventId}/cancel`)
      .set('Cookie', ownerCookie)
      .expect(201);
    assert.equal(cancelled.body.status, 'CANCELLED');

    const hidden = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventSlug}`)
      .expect(404);
    assert.equal(hidden.body.code, 'EVENT_NOT_FOUND');
  });
});
