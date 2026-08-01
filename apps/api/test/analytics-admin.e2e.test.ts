import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
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

describe('analytics and administration', { concurrency: false }, () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminCookie: string;
  let ownerCookie: string;
  let attendeeCookie: string;
  let attendeeId: string;
  let organizationId: string;
  let eventId: string;
  const runId = Date.now();

  before(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);

    const admin = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `analytics-admin-${runId}@example.com`,
        displayName: 'Platform Admin',
        password: 'StrongPassword9',
      })
      .expect(201);
    adminCookie = cookiePair(admin.headers['set-cookie'], 'eventory_access');
    await prisma.user.update({ where: { id: admin.body.user.id }, data: { role: 'ADMIN' } });

    const owner = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `analytics-owner-${runId}@example.com`,
        displayName: 'Analytics Owner',
        password: 'StrongPassword9',
      })
      .expect(201);
    ownerCookie = cookiePair(owner.headers['set-cookie'], 'eventory_access');

    const attendee = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `analytics-attendee-${runId}@example.com`,
        displayName: 'Analytics Attendee',
        password: 'StrongPassword9',
      })
      .expect(201);
    attendeeCookie = cookiePair(attendee.headers['set-cookie'], 'eventory_access');
    attendeeId = attendee.body.user.id as string;

    const organization = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Cookie', ownerCookie)
      .send({ name: `Analytics Lab ${runId}` })
      .expect(201);
    organizationId = organization.body.id as string;
    const event = await prisma.event.create({
      data: {
        organizationId,
        name: `Analytics Event ${runId}`,
        slug: `analytics-event-${runId}`,
        timezone: 'UTC',
        startAt: new Date(Date.now() + 86_400_000),
        endAt: new Date(Date.now() + 90_000_000),
        status: 'SALES_OPEN',
      },
    });
    eventId = event.id;
    await prisma.eventSession.create({
      data: {
        eventId,
        name: 'Analytics session',
        startAt: event.startAt,
        endAt: event.endAt,
        salesStartAt: new Date(Date.now() - 3_600_000),
        salesEndAt: new Date(Date.now() + 80_000_000),
      },
    });
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'analytics-' } } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await app.close();
  });

  it('returns zero-valued event metrics and blocks cross-organization access', async () => {
    const metrics = await request(app.getHttpServer())
      .get(`/api/v1/organizer/events/${eventId}/analytics`)
      .set('Cookie', ownerCookie)
      .expect(200);
    assert.equal(metrics.body.eventId, eventId);
    assert.equal(metrics.body.bookings.total, 0);
    assert.equal(metrics.body.payments.grossMinor, 0);
    assert.deepEqual(metrics.body.payments.currencies, []);
    assert.equal(metrics.body.attendance.issued, 0);
    assert.equal(metrics.body.attendance.checkInRate, 0);

    const denied = await request(app.getHttpServer())
      .get(`/api/v1/organizer/events/${eventId}/analytics`)
      .set('Cookie', attendeeCookie)
      .expect(403);
    assert.equal(denied.body.code, 'ORGANIZATION_ACCESS_DENIED');
  });

  it('bounds admin pages, exposes safe resources, and audits suspension', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/users?page=1&pageSize=2')
      .set('Cookie', ownerCookie)
      .expect(403);

    const users = await request(app.getHttpServer())
      .get('/api/v1/admin/users?page=1&pageSize=2')
      .set('Cookie', adminCookie)
      .expect(200);
    assert.equal(users.body.pageSize, 2);
    assert.ok(users.body.items.length <= 2);
    assert.ok(!('passwordHash' in users.body.items[0]));

    const organizations = await request(app.getHttpServer())
      .get('/api/v1/admin/organizations?page=1&pageSize=5')
      .set('Cookie', adminCookie)
      .expect(200);
    assert.ok(organizations.body.items.some((item: { id: string }) => item.id === organizationId));

    const events = await request(app.getHttpServer())
      .get('/api/v1/admin/events?page=1&pageSize=5&status=SALES_OPEN')
      .set('Cookie', adminCookie)
      .expect(200);
    assert.ok(events.body.items.some((item: { id: string }) => item.id === eventId));

    const suspended = await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${attendeeId}/status`)
      .set('Cookie', adminCookie)
      .send({ status: 'SUSPENDED' })
      .expect(200);
    assert.equal(suspended.body.status, 'SUSPENDED');
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', attendeeCookie)
      .expect(401);

    const audit = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs?page=1&pageSize=10&search=ADMIN_USER_SUSPENDED')
      .set('Cookie', adminCookie)
      .expect(200);
    assert.ok(
      audit.body.items.some((item: { action: string }) => item.action === 'ADMIN_USER_SUSPENDED'),
    );
  });
});
