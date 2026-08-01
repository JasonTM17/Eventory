import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';

describe('health endpoints', () => {
  let app: INestApplication;

  before(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  after(async () => {
    await app.close();
  });

  it('returns a live response with a request id', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    assert.deepEqual(response.body, { status: 'ok', checks: { process: 'up' } });
    assert.equal(typeof response.headers['x-request-id'], 'string');
  });

  it('replaces an invalid caller request id with a bounded generated id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .set('x-request-id', 'request id with spaces')
      .expect(200);

    assert.notEqual(response.headers['x-request-id'], 'request id with spaces');
    assert.match(response.headers['x-request-id'] ?? '', /^[0-9a-f-]{36}$/);
  });

  it('returns readiness when PostgreSQL and Redis are available', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200);
    assert.deepEqual(response.body, {
      status: 'ok',
      checks: { database: 'up', redis: 'up' },
    });
  });
});
