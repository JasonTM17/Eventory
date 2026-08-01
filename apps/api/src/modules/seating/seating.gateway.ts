import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/seating',
  cors: { origin: true, credentials: true },
})
export class SeatingGateway implements OnGatewayConnection {
  @WebSocketServer()
  private server!: Server;

  handleConnection(client: Socket): void {
    client.emit('seating.ready', { version: 1 });
  }

  @SubscribeMessage('joinSession')
  joinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { eventSessionId?: string },
  ): { ok: boolean; code?: string } {
    const eventSessionId = payload?.eventSessionId;
    if (!eventSessionId || !this.isUuid(eventSessionId)) {
      return { ok: false, code: 'INVALID_SESSION' };
    }
    void client.join(this.room(eventSessionId));
    return { ok: true };
  }

  publishSeatChange(
    eventSessionId: string,
    seatIds: string[],
    state: 'held' | 'available',
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
