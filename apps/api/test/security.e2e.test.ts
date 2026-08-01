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

function sessionCookie(headers: string | string[] | undefined, name: string): string {
  const values = Array.isArray(headers) ? headers : headers ? [headers] : [];
  const value = values.find((header) => header.startsWith(`${name}=`));
  assert.ok(value, `Expected ${name} cookie`);
  return value.split(';', 1)[0] as string;
}

function assertNoSessionCookies(headers: string | string[] | undefined): void {
  const values = Array.isArray(headers) ? headers : headers ? [headers] : [];
  assert.equal(
    values.some((value) => value.startsWith('eventory_access=')),
    false,
  );
  assert.equal(
    values.some((value) => value.startsWith('eventory_refresh=')),
    false,
  );
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

  it('blocks untrusted session issuance before persistence or cookies', async () => {
    const trustedEmail = `security-session-${runId}@example.com`;
    const rejectedEmail = `security-evil-${runId}@example.com`;
    const password = 'StrongPassword9';
    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({
        email: trustedEmail,
        displayName: 'Security Session Test',
        password,
      })
      .expect(201);

    const rejectedRegistration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'https://evil.example')
      .type('form')
      .send({
        email: rejectedEmail,
        displayName: 'Evil Registration',
        password,
      })
      .expect(403);
    assert.equal(rejectedRegistration.body.code, 'SESSION_ORIGIN_DENIED');
    assertNoSessionCookies(rejectedRegistration.headers['set-cookie']);
    assert.equal(await prisma.user.findUnique({ where: { email: rejectedEmail } }), null);

    const rejectedOrigin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Referer', 'http://localhost:3000/login')
      .send({ email: trustedEmail, password })
      .expect(403);
    assert.equal(rejectedOrigin.body.code, 'SESSION_ORIGIN_DENIED');
    assertNoSessionCookies(rejectedOrigin.headers['set-cookie']);

    const rejectedNullOrigin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'null')
      .send({ email: trustedEmail, password })
      .expect(403);
    assert.equal(rejectedNullOrigin.body.code, 'SESSION_ORIGIN_DENIED');

    const rejectedReferer = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Referer', 'https://evil.example/session-confusion')
      .send({ email: trustedEmail, password })
      .expect(403);
    assert.equal(rejectedReferer.body.code, 'SESSION_ORIGIN_DENIED');

    const rejectedMalformedReferer = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Referer', 'not a valid URL')
      .send({ email: trustedEmail, password })
      .expect(403);
    assert.equal(rejectedMalformedReferer.body.code, 'SESSION_ORIGIN_DENIED');

    const rejectedHeaderless = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: trustedEmail, password })
      .expect(403);
    assert.equal(rejectedHeaderless.body.code, 'SESSION_ORIGIN_DENIED');

    const rejectedBrowserMetadata = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Sec-Fetch-Site', 'cross-site')
      .set('X-Eventory-Client', 'server')
      .send({ email: trustedEmail, password })
      .expect(403);
    assert.equal(rejectedBrowserMetadata.body.code, 'SESSION_ORIGIN_DENIED');

    const rejectedRefresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Origin', 'https://evil.example')
      .expect(403);
    assert.equal(rejectedRefresh.body.code, 'SESSION_ORIGIN_DENIED');
    assertNoSessionCookies(rejectedRefresh.headers['set-cookie']);

    const originlessServiceLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Eventory-Client', 'server')
      .send({ email: trustedEmail, password })
      .expect(201);
    assert.ok(sessionCookie(originlessServiceLogin.headers['set-cookie'], 'eventory_access'));

    const trustedRefererLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Referer', 'http://localhost:3000/login')
      .send({ email: trustedEmail, password })
      .expect(201);
    assert.ok(sessionCookie(trustedRefererLogin.headers['set-cookie'], 'eventory_access'));

    const refreshCookie = sessionCookie(registered.headers['set-cookie'], 'eventory_refresh');
    const originlessServiceRefresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('X-Eventory-Client', 'server')
      .set('Cookie', refreshCookie)
      .expect(201);
    assert.ok(sessionCookie(originlessServiceRefresh.headers['set-cookie'], 'eventory_refresh'));
  });

  it('rejects cross-site login attempts before consuming a trusted login budget', async () => {
    const rateLimitModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const rateLimitApp = rateLimitModule.createNestApplication();
    rateLimitApp.setGlobalPrefix('api/v1');
    await rateLimitApp.init();
    const rateLimitPrisma = rateLimitApp.get(PrismaService);
    const email = `security-rate-limit-${runId}@example.com`;
    const password = 'StrongPassword9';

    try {
      await request(rateLimitApp.getHttpServer())
        .post('/api/v1/auth/register')
        .set('Origin', 'http://localhost:3000')
        .send({ email, displayName: 'Rate Limit Security Test', password })
        .expect(201);

      for (let attempt = 0; attempt < 10; attempt += 1) {
        const denied = await request(rateLimitApp.getHttpServer())
          .post('/api/v1/auth/login')
          .set('Origin', 'https://evil.example')
          .type('form')
          .send({ email, password })
          .expect(403);
        assert.equal(denied.body.code, 'SESSION_ORIGIN_DENIED');
      }

      const trustedLogin = await request(rateLimitApp.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .send({ email, password })
        .expect(201);
      assert.ok(sessionCookie(trustedLogin.headers['set-cookie'], 'eventory_access'));
    } finally {
      await rateLimitPrisma.user.deleteMany({ where: { email } });
      await rateLimitApp.close();
    }
  });

  it('rejects cross-origin cookie mutations and preserves logout behavior', async () => {
    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
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

    const refreshCookie = sessionCookie(registered.headers['set-cookie'], 'eventory_refresh');
    const deniedLogout = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', [cookie, refreshCookie])
      .set('Origin', 'https://evil.example')
      .expect(403);
    assert.equal(deniedLogout.body.code, 'CSRF_ORIGIN_DENIED');
    assertNoSessionCookies(deniedLogout.headers['set-cookie']);

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie)
      .set('Origin', 'http://localhost:3000')
      .expect(201);
    const refreshedAccessCookie = accessCookie(refreshed.headers['set-cookie']);
    const refreshedRefreshCookie = sessionCookie(
      refreshed.headers['set-cookie'],
      'eventory_refresh',
    );

    const loggedOut = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', [refreshedAccessCookie, refreshedRefreshCookie])
      .set('Origin', 'http://localhost:3000')
      .expect(201);
    assert.ok(sessionCookie(loggedOut.headers['set-cookie'], 'eventory_access'));
    assert.ok(sessionCookie(loggedOut.headers['set-cookie'], 'eventory_refresh'));

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshedRefreshCookie)
      .set('Origin', 'http://localhost:3000')
      .expect(401);

    const metrics = await request(app.getHttpServer()).get('/api/v1/metrics').expect(200);
    assert.match(metrics.text, /eventory_http_requests_total/);
    assert.match(metrics.text, /eventory_active_seat_holds/);
    assert.doesNotMatch(metrics.text, /passwordHash|qrNonce|clientSecret/);
  });
});
