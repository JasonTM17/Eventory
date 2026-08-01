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

describe('identity endpoints', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `identity-${Date.now()}@example.com`;

  before(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('registers a user, sets http-only sessions, and serves the current user', async () => {
    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({
        email: email.toUpperCase(),
        displayName: 'Identity Test',
        password: 'StrongPassword9',
      })
      .expect(201);

    assert.equal(register.body.user.email, email);
    assert.equal(register.body.user.role, 'ATTENDEE');
    assert.ok(cookiePair(register.headers['set-cookie'], 'eventory_access'));
    assert.ok(cookiePair(register.headers['set-cookie'], 'eventory_refresh'));

    const accessCookie = cookiePair(register.headers['set-cookie'], 'eventory_access');
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', accessCookie)
      .expect(200);
    assert.equal(me.body.user.id, register.body.user.id);
  });

  it('rejects weak passwords without writing an account', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({ email: `weak-${email}`, displayName: 'Weak Password', password: 'short' })
      .expect(400);
    assert.equal(response.body.code, 'WEAK_PASSWORD');
  });

  it('returns a generic conflict for duplicate registration', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({ email, displayName: 'Duplicate', password: 'StrongPassword9' })
      .expect(409);
    assert.equal(response.body.code, 'REGISTRATION_CONFLICT');
    assert.doesNotMatch(response.body.message, new RegExp(email, 'i'));
  });

  it('rotates refresh tokens and revokes a family on replay', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email, password: 'StrongPassword9' })
      .expect(201);
    const originalRefreshCookie = cookiePair(login.headers['set-cookie'], 'eventory_refresh');

    const refresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalRefreshCookie)
      .set('Origin', 'http://localhost:3000')
      .expect(201);
    const rotatedRefreshCookie = cookiePair(refresh.headers['set-cookie'], 'eventory_refresh');
    assert.notEqual(rotatedRefreshCookie, originalRefreshCookie);

    const replay = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalRefreshCookie)
      .set('Origin', 'http://localhost:3000')
      .expect(401);
    assert.equal(replay.body.code, 'REFRESH_TOKEN_REUSE');

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', rotatedRefreshCookie)
      .set('Origin', 'http://localhost:3000')
      .expect(401);
  });

  it('does not disclose whether login credentials are wrong', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email, password: 'WrongPassword9' })
      .expect(401);
    assert.equal(response.body.code, 'INVALID_CREDENTIALS');
    assert.equal(response.body.message, 'Invalid email or password');
  });

  it('requires authentication for the current-user endpoint', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    assert.equal(response.body.code, 'AUTHENTICATION_REQUIRED');
  });
});
