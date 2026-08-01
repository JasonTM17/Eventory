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

describe('organization authorization', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerId: string;
  let ownerCookie: string;
  let organizationId: string;
  const ownerEmail = `owner-${Date.now()}@example.com`;
  const foreignEmail = `foreign-${Date.now()}@example.com`;

  before(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    const owner = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({ email: ownerEmail, displayName: 'Owner', password: 'StrongPassword9' })
      .expect(201);
    ownerId = owner.body.user.id as string;
    ownerCookie = cookiePair(owner.headers['set-cookie'], 'eventory_access');
    prisma = app.get(PrismaService);
  });

  after(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, foreignEmail] } } });
    await app.close();
  });

  it('creates an organization and promotes its owner to organizer', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/organizations')
      .set('Cookie', ownerCookie)
      .send({ name: `Eventory Makers ${ownerEmail.split('@')[0]}` })
      .expect(201);
    organizationId = response.body.id as string;
    assert.match(response.body.slug, /^eventory-makers-owner-/);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: ownerId } });
    assert.equal(user.role, 'ORGANIZER');

    const listed = await request(app.getHttpServer())
      .get('/api/v1/organizations')
      .set('Cookie', ownerCookie)
      .expect(200);
    assert.equal(listed.body[0].id, organizationId);
    assert.equal(listed.body[0].membership, 'OWNER');
  });

  it('allows the owner to read the organization and denies a foreign user', async () => {
    const member = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}`)
      .set('Cookie', ownerCookie)
      .expect(200);
    assert.equal(member.body.membership, 'OWNER');

    const foreign = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .send({ email: foreignEmail, displayName: 'Foreign', password: 'StrongPassword9' })
      .expect(201);
    const foreignCookie = cookiePair(foreign.headers['set-cookie'], 'eventory_access');
    const response = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}`)
      .set('Cookie', foreignCookie)
      .expect(403);
    assert.equal(response.body.code, 'ORGANIZATION_ACCESS_DENIED');
  });

  it('prevents a non-owner member from adding organization members', async () => {
    const foreign = await prisma.user.findUniqueOrThrow({ where: { email: foreignEmail } });
    await prisma.organizationMember.create({
      data: { organizationId, userId: foreign.id, role: 'STAFF' },
    });
    const foreignLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: foreignEmail, password: 'StrongPassword9' })
      .expect(201);
    const foreignCookie = cookiePair(foreignLogin.headers['set-cookie'], 'eventory_access');
    const response = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/members`)
      .set('Cookie', foreignCookie)
      .send({ userId: ownerId, role: 'STAFF' })
      .expect(403);
    assert.equal(response.body.code, 'ORGANIZATION_ACCESS_DENIED');
  });
});
