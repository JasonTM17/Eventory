import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { SeatingGateway } from '../src/modules/seating/seating.gateway.js';

function socket(address: string): {
  handshake: { address: string };
  data: Record<string, unknown>;
  disconnectCalled: boolean;
  emit: () => void;
  disconnect: () => void;
  join: () => Promise<void>;
} {
  return {
    handshake: { address },
    data: {},
    disconnectCalled: false,
    emit: () => undefined,
    disconnect() {
      this.disconnectCalled = true;
    },
    join: async () => undefined,
  };
}

describe('seating gateway boundaries', () => {
  it('rejects disallowed origins at the Engine.IO handshake', () => {
    const gateway = new SeatingGateway(
      new ConfigService({ CORS_ORIGINS: 'http://localhost:3000' }),
    );
    const server: { server: { engine: { opts: Record<string, unknown> } } } = {
      server: { engine: { opts: {} } },
    };
    gateway.afterInit(server as never);
    const allowRequest = server.server.engine.opts.allowRequest as (
      request: { headers: { origin?: string } },
      callback: (error: string | null, allowed: boolean) => void,
    ) => void;

    let result: [string | null, boolean] | undefined;
    allowRequest({ headers: { origin: 'https://attacker.example' } }, (error, allowed) => {
      result = [error, allowed];
    });
    assert.deepEqual(result, ['SEATING_ORIGIN_DENIED', false]);

    allowRequest({ headers: {} }, (error, allowed) => {
      result = [error, allowed];
    });
    assert.deepEqual(result, [null, true]);
  });

  it('bounds connections and joined public sessions', () => {
    const gateway = new SeatingGateway(
      new ConfigService({ CORS_ORIGINS: 'http://localhost:3000' }),
    );
    const clients = Array.from({ length: 21 }, () => socket('127.0.0.1'));
    clients.forEach((client) => gateway.handleConnection(client as never));
    assert.equal(clients[20]?.disconnectCalled, true);
    gateway.handleDisconnect(clients[20] as never);
    const stillRejected = socket('127.0.0.1');
    gateway.handleConnection(stillRejected as never);
    assert.equal(stillRejected.disconnectCalled, true);

    const client = clients[0] as never;
    for (let index = 0; index < 10; index += 1) {
      const sessionId = `11111111-1111-4${String(index).padStart(3, '0')}-8111-111111111111`;
      assert.deepEqual(gateway.joinSession(client, { eventSessionId: sessionId }), { ok: true });
    }
    assert.deepEqual(
      gateway.joinSession(client, { eventSessionId: '22222222-2222-4222-8222-222222222222' }),
      { ok: false, code: 'JOIN_LIMIT_REACHED' },
    );
  });
});
