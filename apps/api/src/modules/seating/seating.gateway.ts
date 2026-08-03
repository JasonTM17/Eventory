import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { createTrustedOrigins, isTrustedOrigin } from '../../common/security/origin-policy.js';
import type { Namespace, Socket } from 'socket.io';

const MAX_CONNECTIONS_PER_IP = 20;
const MAX_JOINED_SESSIONS_PER_SOCKET = 10;
const MAX_JOIN_REQUESTS = 60;
const JOIN_WINDOW_MS = 60_000;

interface SeatingSocketData {
  ip: string;
  countedConnection: boolean;
  joinedSessions: Set<string>;
  joinWindowStartedAt: number;
  joinCount: number;
}

@WebSocketGateway({
  namespace: '/seating',
  // Engine.IO creates its CORS middleware before Nest can inject ConfigService.
  // Reflect the request origin for browser headers; allowRequest below remains
  // the trust boundary and rejects every origin outside CORS_ORIGINS.
  cors: { origin: true, credentials: true },
})
export class SeatingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Namespace;

  private readonly allowedOrigins: ReadonlySet<string>;
  private readonly connectionsByIp = new Map<string, number>();

  constructor(config: ConfigService) {
    this.allowedOrigins = createTrustedOrigins(config.getOrThrow<string>('CORS_ORIGINS'));
  }

  afterInit(server: Namespace): void {
    const engine = server?.server?.engine;
    if (!engine) return;

    engine.opts.allowRequest = (request, callback) => {
      const origin =
        typeof request.headers.origin === 'string' ? request.headers.origin : undefined;
      if (!origin || isTrustedOrigin(origin, this.allowedOrigins)) {
        callback(null, true);
        return;
      }
      callback('SEATING_ORIGIN_DENIED', false);
    };
  }

  handleConnection(client: Socket): void {
    const ip = client.handshake.address || 'unknown';
    const connections = this.connectionsByIp.get(ip) ?? 0;
    if (connections >= MAX_CONNECTIONS_PER_IP) {
      client.data = { ip, countedConnection: false } satisfies Partial<SeatingSocketData>;
      client.disconnect(true);
      return;
    }
    this.connectionsByIp.set(ip, connections + 1);
    client.data = {
      ip,
      countedConnection: true,
      joinedSessions: new Set<string>(),
      joinWindowStartedAt: Date.now(),
      joinCount: 0,
    } satisfies SeatingSocketData;
    client.emit('seating.ready', { version: 1 });
  }

  handleDisconnect(client: Socket): void {
    const data = client.data as Partial<SeatingSocketData>;
    if (data.countedConnection !== true) return;
    const ip = typeof data.ip === 'string' ? data.ip : client.handshake.address || 'unknown';
    const connections = this.connectionsByIp.get(ip) ?? 0;
    if (connections <= 1) this.connectionsByIp.delete(ip);
    else this.connectionsByIp.set(ip, connections - 1);
  }

  @SubscribeMessage('joinSession')
  joinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { eventSessionId?: unknown },
  ): { ok: boolean; code?: string } {
    const data = client.data as SeatingSocketData;
    const now = Date.now();
    if (now - data.joinWindowStartedAt >= JOIN_WINDOW_MS) {
      data.joinWindowStartedAt = now;
      data.joinCount = 0;
    }
    if (data.joinCount >= MAX_JOIN_REQUESTS) return { ok: false, code: 'RATE_LIMITED' };
    data.joinCount += 1;

    const eventSessionId = payload?.eventSessionId;
    if (typeof eventSessionId !== 'string' || !this.isUuid(eventSessionId)) {
      return { ok: false, code: 'INVALID_SESSION' };
    }
    if (
      !data.joinedSessions.has(eventSessionId) &&
      data.joinedSessions.size >= MAX_JOINED_SESSIONS_PER_SOCKET
    ) {
      return { ok: false, code: 'JOIN_LIMIT_REACHED' };
    }
    data.joinedSessions.add(eventSessionId);
    void client.join(this.room(eventSessionId));
    return { ok: true };
  }

  publishSeatChange(
    eventSessionId: string,
    seatIds: string[],
    state: 'held' | 'available' | 'blocked' | 'sold',
    expiresAt?: string,
  ): void {
    if (!this.server) return;
    this.server.to(this.room(eventSessionId)).emit('seat.updated', {
      eventSessionId,
      seatIds,
      state,
      ...(expiresAt ? { holdExpiresAt: expiresAt } : {}),
    });
  }

  private room(eventSessionId: string): string {
    return `session:${eventSessionId}`;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }
}
