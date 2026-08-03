import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module.js';

process.env.OUTBOX_WORKER_ENABLED = 'false';

function socketUrl(app: INestApplication): string {
  const address = app.getHttpServer().address() as AddressInfo | string | null;
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}

function connectWithOrigin(url: string, origin: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const client = io(`${url}/seating`, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 2_000,
      extraHeaders: { Origin: origin },
    });
    const timer = setTimeout(() => {
      client.close();
      reject(new Error('Timed out waiting for the seating WebSocket connection'));
    }, 3_000);
    client.once('connect', () => {
      clearTimeout(timer);
      resolve(client);
    });
    client.once('connect_error', (error) => {
      clearTimeout(timer);
      client.close();
      reject(error);
    });
  });
}

function assertRejectedWithOrigin(url: string, origin: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = io(`${url}/seating`, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 2_000,
      extraHeaders: { Origin: origin },
    });
    const timer = setTimeout(() => {
      client.close();
      reject(new Error('Timed out waiting for the rejected seating WebSocket handshake'));
    }, 3_000);
    client.once('connect', () => {
      clearTimeout(timer);
      client.close();
      reject(new Error('The disallowed seating WebSocket origin connected'));
    });
    client.once('connect_error', () => {
      clearTimeout(timer);
      client.close();
      resolve();
    });
  });
}

describe('seating WebSocket handshake', { concurrency: false }, () => {
  let app: INestApplication;
  let url: string;

  before(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    url = socketUrl(app);
  });

  after(async () => {
    await app.close();
  });

  it('allows trusted and rejects untrusted native WebSocket origins', async () => {
    const trusted = await connectWithOrigin(url, 'http://localhost:3000');
    trusted.close();
    await assertRejectedWithOrigin(url, 'https://attacker.example');
  });

  it('returns browser CORS headers only after a trusted polling handshake', async () => {
    const endpoint = `${url}/socket.io/?EIO=4&transport=polling`;
    const response = await fetch(endpoint, {
      headers: { Origin: 'http://localhost:3000' },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:3000');
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');

    const handshake = (await response.text()).slice(1);
    const { sid } = JSON.parse(handshake) as { sid: string };
    await fetch(`${endpoint}&sid=${encodeURIComponent(sid)}`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:3000',
        'content-type': 'text/plain;charset=UTF-8',
      },
      body: '1',
    });

    const rejected = await fetch(endpoint, {
      headers: { Origin: 'https://attacker.example' },
    });
    assert.equal(rejected.status, 403);
  });
});
