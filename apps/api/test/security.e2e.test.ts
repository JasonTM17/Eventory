import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/infrastructure/database/prisma.service.js';

function accessCookie(headers: string | string[] | undefined): string {
  const values = Array.isArray(headers) ? headers : headers ? [headers] : [];
  const cookie = values.find((value) => value.startsWith('eventory_access='));
  assert.ok(cookie, 'Expected access cookie');
  return cookie.split(';', 1)[0] as string;
}

describe('security hardening', { concurrency: false }, () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let organizationId: string | undefined;
  const runId = Date.now();

  before(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);
  });

  after(async () => {
    if (organizationId) await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: `security-${runId}` } } });
    await app.close();
  });

  it('rejects cross-origin cookie mutations and exposes low-cardinality metrics', async () => {
    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `security-${runId}@example.com`,
        displayName: 'Security Test',
        password: 'StrongPassword9',
      })
      .expect(201);
    const cookie = accessCookie(registered.headers['set-cookie']);

    const denied = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example')
      .send({ name: `Denied ${runId}` })
      .expect(403);
    assert.equal(denied.body.code, 'CSRF_ORIGIN_DENIED');

    const created = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Cookie', cookie)
      .set('Origin', 'http://localhost:3000')
      .send({ name: `Allowed ${runId}` })
      .expect(201);
    organizationId = created.body.id as string;

    const metrics = await request(app.getHttpServer()).get('/api/v1/metrics').expect(200);
    assert.match(metrics.text, /eventory_http_requests_total/);
    assert.match(metrics.text, /eventory_active_seat_holds/);
    assert.doesNotMatch(metrics.text, /passwordHash|qrNonce|clientSecret/);
  });
});
