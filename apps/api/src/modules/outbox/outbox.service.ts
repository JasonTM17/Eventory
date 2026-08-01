import { Injectable, Logger } from '@nestjs/common';
import { Prisma, NotificationStatus, OutboxStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { EmailService } from './email.service.js';

const MAX_ATTEMPTS = 5;
const LEASE_TIMEOUT_MINUTES = 5;

interface ClaimedOutboxEvent {
  id: string;
  topic: string;
  aggregateId: string;
  bookingId: string | null;
  payload: Prisma.JsonValue;
  attempts: number;
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async processOnce(limit = 20): Promise<number> {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
    const claimed = await this.claim(safeLimit);
    for (const event of claimed) {
      try {
        await this.dispatch(event);
      } catch (error) {
        await this.markFailure(event, error);
      }
    }
    return claimed.length;
  }

  private async claim(limit: number): Promise<ClaimedOutboxEvent[]> {
    return this.prisma.$queryRaw<ClaimedOutboxEvent[]>(Prisma.sql`
      WITH candidates AS (
        SELECT "id"
        FROM "outbox_events"
        WHERE (
          ("status" = 'PENDING'::"OutboxStatus" AND "nextAttemptAt" <= NOW())
          OR ("status" = 'PROCESSING'::"OutboxStatus"
            AND "updatedAt" < NOW() - (${LEASE_TIMEOUT_MINUTES} * INTERVAL '1 minute'))
        )
        ORDER BY "createdAt"
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      UPDATE "outbox_events" AS event
      SET
        "status" = 'PROCESSING'::"OutboxStatus",
        "attempts" = event."attempts" + 1,
        "updatedAt" = NOW()
      FROM candidates
      WHERE event."id" = candidates."id"
      RETURNING event."id", event."topic", event."aggregateId", event."bookingId", event."payload", event."attempts"
    `);
  }

  private async dispatch(event: ClaimedOutboxEvent): Promise<void> {
    if (!this.isNotificationTopic(event.topic)) {
      await this.markProcessed(event.id);
      return;
    }
    if (!event.bookingId) throw new Error('Notification outbox event has no booking aggregate');

    const booking = await this.prisma.booking.findUnique({
      where: { id: event.bookingId },
      include: { user: true },
    });
    if (!booking) throw new Error('Booking notification aggregate no longer exists');

    const template = this.templateFor(event.topic);
    const dedupeKey = `${event.topic}:${booking.id}:EMAIL`;
    const delivery = await this.prisma.notificationDelivery.upsert({
      where: { dedupeKey },
      create: {
        dedupeKey,
        outboxEventId: event.id,
        bookingId: booking.id,
        channel: 'EMAIL',
        recipient: booking.user.email,
        template,
        payload: { bookingId: booking.id, publicCode: booking.publicCode },
      },
      update: {},
    });
    if (delivery.status === NotificationStatus.SENT) {
      await this.markProcessed(event.id);
      return;
    }

    const processing = await this.prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: NotificationStatus.PROCESSING,
        attempts: { increment: 1 },
        lastError: null,
      },
    });
    try {
      await this.email.send({
        recipient: processing.recipient,
        subject: this.subjectFor(event.topic, booking.publicCode),
        text: this.bodyFor(event.topic, booking.publicCode),
      });
      await this.prisma.$transaction([
        this.prisma.notificationDelivery.update({
          where: { id: processing.id },
          data: { status: NotificationStatus.SENT, sentAt: new Date(), lastError: null },
        }),
        this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: OutboxStatus.PROCESSED, processedAt: new Date(), lastError: null },
        }),
      ]);
    } catch (error) {
      const dead = processing.attempts >= MAX_ATTEMPTS;
      await this.prisma.notificationDelivery.update({
        where: { id: processing.id },
        data: {
          status: dead ? NotificationStatus.DEAD : NotificationStatus.FAILED,
          nextAttemptAt: this.nextAttempt(processing.attempts),
          lastError: this.safeError(error),
        },
      });
      throw error;
    }
  }

  private async markProcessed(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { status: OutboxStatus.PROCESSED, processedAt: new Date(), lastError: null },
    });
  }

  private async markFailure(event: ClaimedOutboxEvent, error: unknown): Promise<void> {
    const dead = event.attempts >= MAX_ATTEMPTS;
    const message = this.safeError(error);
    await this.prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: dead ? OutboxStatus.DEAD : OutboxStatus.PENDING,
        nextAttemptAt: this.nextAttempt(event.attempts),
        lastError: message,
      },
    });
    if (dead) this.logger.warn(`Outbox event ${event.id} moved to dead letter: ${message}`);
  }

  private isNotificationTopic(topic: string): boolean {
    return (
      topic === 'booking.created' ||
      topic === 'booking.confirmed' ||
      topic === 'booking.payment_failed'
    );
  }

  private templateFor(topic: string): string {
    if (topic === 'booking.confirmed') return 'booking-confirmed';
    if (topic === 'booking.payment_failed') return 'booking-payment-failed';
    return 'booking-created';
  }

  private subjectFor(topic: string, publicCode: string): string {
    if (topic === 'booking.confirmed') return `Eventory ticket confirmed · ${publicCode}`;
    if (topic === 'booking.payment_failed')
      return `Eventory payment needs attention · ${publicCode}`;
    return `Eventory booking started · ${publicCode}`;
  }

  private bodyFor(topic: string, publicCode: string): string {
    if (topic === 'booking.confirmed') {
      return `Your booking ${publicCode} is confirmed. Your tickets are ready in Eventory.`;
    }
    if (topic === 'booking.payment_failed') {
      return `Payment for booking ${publicCode} did not complete. Please try checkout again.`;
    }
    return `Booking ${publicCode} was created. Complete payment before the hold expires.`;
  }

  private nextAttempt(attempts: number): Date {
    const delayMs = Math.min(15 * 60_000, 1_000 * 2 ** Math.max(0, attempts - 1));
    return new Date(Date.now() + delayMs);
  }

  private safeError(error: unknown): string {
    return (error instanceof Error ? error.message : 'Unknown delivery error').slice(0, 500);
  }
}
