import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  BookingStatus,
  EventStatus,
  PaymentEventStatus,
  PaymentReconciliationStatus,
  PaymentStatus,
  PaymentWebhookInboxStatus,
  Prisma,
  SeatAllocationStatus,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { SeatingService } from '../seating/seating.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import type { PaymentWebhookPayload } from '../payments/payment-provider.js';

const BOOKING_IDEMPOTENCY_SCOPE = 'booking:create';
const BOOKING_TTL_MS = 10 * 60 * 1_000;
const PROVIDER_ATTEMPT_LEASE_MS = 30 * 1_000;

type BookingWithDetails = Prisma.BookingGetPayload<{
  include: { items: true; payment: true };
}>;

export interface BookingView {
  id: string;
  publicCode: string;
  eventSessionId: string;
  status: BookingStatus;
  currency: string;
  subtotalMinor: number;
  feeMinor: number;
  totalMinor: number;
  expiresAt: string;
  confirmedAt: string | null;
  items: Array<{
    id: string;
    seatCode: string | null;
    ticketTypeName: string;
    priceMinor: number;
    currency: string;
  }>;
  payment: {
    providerReference: string | null;
    status: PaymentStatus;
    amountMinor: number;
    currency: string;
    clientSecret: string | null;
    expiresAt: string | null;
  } | null;
}

interface AcceptedPaymentWebhook {
  accepted: true;
  status: 'UNMATCHED_PROVIDER_EVENT';
  providerEventId: string;
}

type PaymentWebhookResult = BookingView | AcceptedPaymentWebhook;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seating: SeatingService,
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  async create(
    userId: string,
    input: {
      eventSessionId: string;
      seatIds: string[];
      holdToken: string;
      idempotencyKey?: string;
      clientTotalMinor?: number;
    },
  ): Promise<BookingView> {
    const normalizedKey = input.idempotencyKey?.trim();
    const requestFingerprint = normalizedKey
      ? this.requestFingerprint(
          input.eventSessionId,
          input.seatIds,
          input.holdToken,
          input.clientTotalMinor,
        )
      : undefined;
    if (normalizedKey) {
      const existing = await this.findIdempotent(userId, normalizedKey);
      if (existing) {
        this.assertIdempotencyFingerprint(existing.requestFingerprint, requestFingerprint);
        return this.replayIdempotency(userId, normalizedKey, existing);
      }
    }

    const hold = await this.seating.assertOwnedHold(
      input.eventSessionId,
      userId,
      input.seatIds,
      await this.resolveHoldId(input.eventSessionId, userId, input.seatIds, input.holdToken),
    );
    const source = await this.getSaleSnapshot(input.eventSessionId, hold.seatIds);
    const bookingId = randomUUID();
    const expiresAt = new Date(
      Math.min(new Date(hold.expiresAt).getTime(), Date.now() + BOOKING_TTL_MS),
    );
    try {
      const booking = await this.prisma.$transaction(async (tx) => {
        const allocations = await tx.seatAllocation.findMany({
          where: {
            eventSessionId: input.eventSessionId,
            seatId: { in: hold.seatIds },
          },
          include: { seat: true, ticketType: true },
        });
        this.assertSaleSnapshot(allocations, hold.seatIds);
        const now = new Date();
        if (now >= expiresAt) this.throwHoldExpired();

        const transactionSource = this.saleSnapshotFromAllocations(allocations);
        if (
          transactionSource.currency !== source.currency ||
          transactionSource.totalMinor !== source.totalMinor
        ) {
          throw new ConflictException({
            code: 'SALE_SNAPSHOT_CHANGED',
            message: 'The ticket price changed while checkout was starting',
          });
        }

        const created = await tx.booking.create({
          data: {
            id: bookingId,
            publicCode: this.publicCode('EVT'),
            userId,
            eventSessionId: input.eventSessionId,
            holdId: hold.holdId,
            currency: source.currency,
            subtotalMinor: source.totalMinor,
            totalMinor: source.totalMinor,
            expiresAt,
            items: {
              create: allocations.map((allocation) => ({
                seatAllocationId: allocation.id,
                seatId: allocation.seatId,
                ticketTypeId: allocation.ticketTypeId,
                ticketTypeName: allocation.ticketType?.name ?? 'Ticket',
                seatCode: allocation.seat.code,
                priceMinor: allocation.ticketType?.priceMinor ?? 0,
                currency: allocation.ticketType?.currency ?? source.currency,
              })),
            },
            payment: {
              create: {
                provider: 'MOCK',
                providerIdempotencyKey: `booking:${bookingId}`,
                status: PaymentStatus.PENDING,
                amountMinor: source.totalMinor,
                currency: source.currency,
                expiresAt,
              },
            },
          },
          include: { items: true, payment: true },
        });

        if (normalizedKey && requestFingerprint) {
          await tx.idempotencyRecord.create({
            data: {
              scope: BOOKING_IDEMPOTENCY_SCOPE,
              key: this.idempotencyKey(userId, normalizedKey),
              userId,
              bookingId: created.id,
              requestFingerprint,
              responseStatus: 202,
              responseBody: { state: 'PROVIDER_INITIALIZATION_PENDING' },
              expiresAt,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            action: 'BOOKING_CREATED',
            resourceType: 'Booking',
            resourceId: created.id,
            actorUserId: userId,
            metadata: {
              eventSessionId: created.eventSessionId,
              totalMinor: created.totalMinor,
              currency: created.currency,
            },
          },
        });

        await this.enqueue(tx, created.id, 'booking.created', {
          bookingId: created.id,
          publicCode: created.publicCode,
        });

        return created;
      });
      const response = await this.ensureProviderPayment(booking.id);
      if (normalizedKey && requestFingerprint) {
        await this.storeIdempotency(
          userId,
          normalizedKey,
          requestFingerprint,
          response,
          response.expiresAt,
        );
      }
      return response;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        if (normalizedKey && requestFingerprint) {
          const existingIdempotency = await this.findIdempotent(userId, normalizedKey);
          if (existingIdempotency) {
            this.assertIdempotencyFingerprint(
              existingIdempotency.requestFingerprint,
              requestFingerprint,
            );
            return this.replayIdempotency(userId, normalizedKey, existingIdempotency);
          }
        }
        const existing = await this.prisma.booking.findUnique({
          where: { holdId: hold.holdId },
          include: { items: true, payment: true },
        });
        if (existing) {
          this.assertBookingMatchesRequest(
            existing,
            userId,
            input.eventSessionId,
            hold.seatIds,
            input.clientTotalMinor,
          );
          const response = await this.ensureProviderPayment(existing.id);
          if (normalizedKey && requestFingerprint) {
            await this.storeIdempotency(
              userId,
              normalizedKey,
              requestFingerprint,
              response,
              response.expiresAt,
            );
          }
          return response;
        }
      }
      throw error;
    }
  }

  async get(userId: string, bookingId: string): Promise<BookingView> {
    const booking = await this.findBooking(userId, bookingId);
    if (!booking)
      throw new NotFoundException({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
    await this.ensureProviderPayment(booking.id);
    return this.toView((await this.findBooking(userId, bookingId)) ?? booking);
  }

  async expirePendingBookings(limit = 50): Promise<number> {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 200));
    const candidates = await this.prisma.booking.findMany({
      where: { status: BookingStatus.PENDING, expiresAt: { lte: new Date() } },
      select: { id: true },
      orderBy: { expiresAt: 'asc' },
      take: safeLimit,
    });
    let expiredCount = 0;
    for (const candidate of candidates) {
      const expired = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`
          SELECT "id"
          FROM "bookings"
          WHERE "id" = ${candidate.id}
          FOR UPDATE
        `);
        const booking = await this.findBookingInTransaction(tx, candidate.id);
        const changed = await this.expirePendingBookingInTransaction(tx, booking);
        if (!changed) return false;
        await tx.auditLog.create({
          data: {
            action: 'BOOKING_EXPIRED',
            resourceType: 'Booking',
            resourceId: booking.id,
            metadata: { reason: 'CHECKOUT_EXPIRY_WORKER' },
          },
        });
        return true;
      });
      if (expired) expiredCount += 1;
    }
    return expiredCount;
  }

  async recoverPendingProviderPayments(limit = 50): Promise<number> {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 200));
    const staleBefore = new Date(Date.now() - PROVIDER_ATTEMPT_LEASE_MS);
    const candidates = await this.prisma.payment.findMany({
      where: {
        providerReference: null,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
        OR: [{ providerAttemptedAt: null }, { providerAttemptedAt: { lt: staleBefore } }],
      },
      select: { bookingId: true },
      orderBy: { updatedAt: 'asc' },
      take: safeLimit,
    });
    for (const candidate of candidates) {
      await this.ensureProviderPayment(candidate.bookingId, { allowExpiredRecovery: true });
    }
    return candidates.length;
  }

  async reconcilePendingPaymentWebhooks(limit = 50): Promise<number> {
    const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 200));
    const candidates = await this.prisma.paymentWebhookInbox.findMany({
      where: { status: PaymentWebhookInboxStatus.RECEIVED },
      orderBy: { receivedAt: 'asc' },
      take: safeLimit,
    });
    let processed = 0;
    for (const candidate of candidates) {
      if (!this.isPaymentWebhookType(candidate.eventType)) {
        await this.ignorePaymentWebhookInbox(candidate.id, 'UNSUPPORTED_EVENT_TYPE');
        continue;
      }
      const payment = await this.prisma.payment.findUnique({
        where: { providerReference: candidate.reference },
        select: { id: true },
      });
      if (!payment) continue;
      let result: PaymentWebhookResult;
      try {
        result = await this.handlePaymentWebhook({
          id: candidate.providerEventId,
          type: candidate.eventType,
          reference: candidate.reference,
          amountMinor: candidate.amountMinor,
          currency: candidate.currency,
        });
      } catch (error) {
        if (this.isPermanentWebhookInboxError(error)) {
          await this.ignorePaymentWebhookInbox(candidate.id, this.webhookErrorCode(error));
          continue;
        }
        throw error;
      }
      if ('accepted' in result) continue;
      await this.prisma.paymentWebhookInbox.update({
        where: { id: candidate.id, status: PaymentWebhookInboxStatus.RECEIVED },
        data: { status: PaymentWebhookInboxStatus.PROCESSED, processedAt: new Date() },
      });
      processed += 1;
    }
    return processed;
  }

  async handlePaymentWebhook(payload: PaymentWebhookPayload): Promise<PaymentWebhookResult> {
    const normalizedPayload = {
      ...payload,
      reference: payload.reference.trim(),
      currency: payload.currency.trim().toUpperCase(),
    };
    const payment = await this.prisma.payment.findUnique({
      where: { providerReference: normalizedPayload.reference },
    });
    if (!payment) return this.storeUnmatchedPaymentWebhook(normalizedPayload);
    this.assertPaymentAmount(payment.amountMinor, payment.currency, normalizedPayload);

    const event = await this.recordPaymentEvent(payment.id, normalizedPayload);
    this.assertPaymentEventMatches(event, payment.id, normalizedPayload);
    try {
      return await this.prisma.$transaction((tx) =>
        this.applyPaymentWebhook(tx, payment.id, event.id, normalizedPayload),
      );
    } catch (error) {
      if (normalizedPayload.type === 'payment.succeeded' && this.isFulfillmentConflict(error)) {
        return this.reconcileFulfillmentFailure(payment.id, event.id, normalizedPayload, error);
      }
      throw error;
    }
  }

  private async applyPaymentWebhook(
    tx: Prisma.TransactionClient,
    paymentId: string,
    eventId: string,
    payload: PaymentWebhookPayload,
  ): Promise<BookingView> {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    await tx.$queryRaw(Prisma.sql`
      SELECT "id"
      FROM "bookings"
      WHERE "id" = ${payment.bookingId}
      FOR UPDATE
    `);

    const currentEvent = await tx.paymentEvent.findUniqueOrThrow({ where: { id: eventId } });
    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: payment.bookingId },
      include: { items: true, payment: true },
    });
    if (currentEvent.status !== PaymentEventStatus.RECEIVED) return this.toView(booking);

    await tx.auditLog.create({
      data: {
        action: 'PAYMENT_WEBHOOK_ACCEPTED',
        resourceType: 'Payment',
        resourceId: payment.id,
        metadata: { eventType: payload.type, providerEventId: payload.id },
      },
    });

    if (
      booking.status === BookingStatus.CONFIRMED ||
      booking.payment?.status === PaymentStatus.SUCCEEDED ||
      booking.payment?.status === PaymentStatus.REQUIRES_RECONCILIATION
    ) {
      await this.markPaymentEvent(tx, eventId, PaymentEventStatus.IGNORED);
      await tx.auditLog.create({
        data: {
          action: 'PAYMENT_WEBHOOK_IGNORED',
          resourceType: 'Payment',
          resourceId: payment.id,
          metadata: { reason: 'TERMINAL_SUCCESS', providerEventId: payload.id },
        },
      });
      return this.toView(booking);
    }

    const now = new Date();
    if (payload.type === 'payment.succeeded') {
      if (booking.status !== BookingStatus.PENDING || booking.expiresAt <= now) {
        return this.markLatePayment(tx, booking, payment.id, eventId, payload);
      }

      try {
        await this.seating.assertOwnedHold(
          booking.eventSessionId,
          booking.userId,
          booking.items.map((item) => item.seatId),
          booking.holdId,
        );
      } catch (error) {
        if (!this.isHoldUnavailable(error)) throw error;
        return this.markLatePayment(tx, booking, payment.id, eventId, payload);
      }

      const updatedSeats = await tx.seatAllocation.updateMany({
        where: {
          id: { in: booking.items.map((item) => item.seatAllocationId) },
          status: SeatAllocationStatus.AVAILABLE,
        },
        data: { status: SeatAllocationStatus.SOLD },
      });
      if (updatedSeats.count !== booking.items.length) {
        throw new ConflictException({
          code: 'SEAT_ALREADY_SOLD',
          message: 'One or more seats are no longer available',
        });
      }
      await this.incrementTicketTypeCounts(tx, booking.items);
      await tx.ticket.createMany({
        data: booking.items.map((item) => ({
          bookingId: booking.id,
          bookingItemId: item.id,
          userId: booking.userId,
          eventSessionId: booking.eventSessionId,
          publicCode: this.publicCode('TKT'),
          qrNonce: randomBytes(24).toString('base64url'),
          qrKeyVersion: this.config.getOrThrow<number>('QR_KEY_VERSION'),
        })),
      });
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CONFIRMED, confirmedAt: now },
      });
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.SUCCEEDED, providerLastError: null },
      });
      await this.enqueue(tx, booking.id, 'booking.confirmed', {
        bookingId: booking.id,
        publicCode: booking.publicCode,
      });
      await this.markPaymentEvent(tx, eventId, PaymentEventStatus.PROCESSED);
      return this.toView(await this.findBookingInTransaction(tx, booking.id));
    }

    if (booking.status !== BookingStatus.PENDING) {
      await this.markPaymentEvent(tx, eventId, PaymentEventStatus.IGNORED);
      return this.toView(booking);
    }

    const expired = payload.type === 'payment.expired' || booking.expiresAt <= now;
    if (expired) {
      await this.expirePendingBookingInTransaction(tx, booking, true);
    } else {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.PAYMENT_FAILED },
      });
      await this.enqueue(tx, booking.id, 'booking.payment_failed', {
        bookingId: booking.id,
        publicCode: booking.publicCode,
      });
    }
    await this.markPaymentEvent(tx, eventId, PaymentEventStatus.PROCESSED);
    return this.toView(await this.findBookingInTransaction(tx, booking.id));
  }

  async completeMockPayment(
    providerReference: string,
    outcome: 'succeed' | 'fail' | 'expire',
  ): Promise<BookingView> {
    const payment = await this.prisma.payment.findUnique({
      where: { providerReference },
      select: { amountMinor: true, currency: true },
    });
    if (!payment)
      throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' });
    const result = await this.handlePaymentWebhook({
      id: randomUUID(),
      type:
        outcome === 'succeed'
          ? 'payment.succeeded'
          : outcome === 'fail'
            ? 'payment.failed'
            : 'payment.expired',
      reference: providerReference,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
    });
    if ('accepted' in result) {
      throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' });
    }
    return result;
  }

  private async storeUnmatchedPaymentWebhook(
    payload: PaymentWebhookPayload,
  ): Promise<AcceptedPaymentWebhook> {
    const inbox = await this.prisma.paymentWebhookInbox.upsert({
      where: { provider_providerEventId: { provider: 'MOCK', providerEventId: payload.id } },
      create: {
        provider: 'MOCK',
        providerEventId: payload.id,
        eventType: payload.type,
        reference: payload.reference,
        amountMinor: payload.amountMinor,
        currency: payload.currency,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
      update: {},
    });
    if (
      inbox.eventType !== payload.type ||
      inbox.reference !== payload.reference ||
      inbox.amountMinor !== payload.amountMinor ||
      inbox.currency !== payload.currency
    ) {
      throw new ConflictException({
        code: 'PAYMENT_EVENT_REPLAY_MISMATCH',
        message: 'The provider event identity was already used with another payload',
      });
    }
    return { accepted: true, status: 'UNMATCHED_PROVIDER_EVENT', providerEventId: payload.id };
  }

  private async recordPaymentEvent(paymentId: string, payload: PaymentWebhookPayload) {
    return this.prisma.paymentEvent.upsert({
      where: { provider_providerEventId: { provider: 'MOCK', providerEventId: payload.id } },
      create: {
        paymentId,
        provider: 'MOCK',
        providerEventId: payload.id,
        eventType: payload.type,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
      update: {},
    });
  }

  private assertPaymentEventMatches(
    event: { paymentId: string; eventType: string },
    paymentId: string,
    payload: PaymentWebhookPayload,
  ): void {
    if (event.paymentId !== paymentId || event.eventType !== payload.type) {
      throw new ConflictException({
        code: 'PAYMENT_EVENT_REPLAY_MISMATCH',
        message: 'The provider event identity was already used for another payment',
      });
    }
  }

  private isPaymentWebhookType(value: string): value is PaymentWebhookPayload['type'] {
    return (
      value === 'payment.succeeded' || value === 'payment.failed' || value === 'payment.expired'
    );
  }

  private isPermanentWebhookInboxError(error: unknown): boolean {
    return ['PAYMENT_AMOUNT_MISMATCH', 'PAYMENT_EVENT_REPLAY_MISMATCH'].includes(
      this.webhookErrorCode(error),
    );
  }

  private webhookErrorCode(error: unknown): string {
    if (!(error instanceof ConflictException)) return 'WEBHOOK_PROCESSING_FAILED';
    const response = error.getResponse();
    if (typeof response !== 'object' || response === null) return 'WEBHOOK_PROCESSING_FAILED';
    const code = (response as { code?: unknown }).code;
    return typeof code === 'string' ? code : 'WEBHOOK_PROCESSING_FAILED';
  }

  private async ignorePaymentWebhookInbox(id: string, reason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.paymentWebhookInbox.updateMany({
        where: { id, status: PaymentWebhookInboxStatus.RECEIVED },
        data: { status: PaymentWebhookInboxStatus.IGNORED, processedAt: new Date() },
      });
      if (updated.count !== 1) return;
      await tx.auditLog.create({
        data: {
          action: 'PAYMENT_WEBHOOK_IGNORED',
          resourceType: 'PaymentWebhookInbox',
          resourceId: id,
          metadata: { reason },
        },
      });
    });
  }

  private assertPaymentAmount(
    amountMinor: number,
    currency: string,
    payload: PaymentWebhookPayload,
  ): void {
    if (amountMinor !== payload.amountMinor || currency !== payload.currency) {
      throw new ConflictException({
        code: 'PAYMENT_AMOUNT_MISMATCH',
        message: 'Payment amount or currency does not match the booking',
      });
    }
  }

  private async reconcileFulfillmentFailure(
    paymentId: string,
    eventId: string,
    payload: PaymentWebhookPayload,
    error: unknown,
  ): Promise<BookingView> {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      await tx.$queryRaw(Prisma.sql`
        SELECT "id"
        FROM "bookings"
        WHERE "id" = ${payment.bookingId}
        FOR UPDATE
      `);
      const booking = await tx.booking.findUniqueOrThrow({
        where: { id: payment.bookingId },
        include: { items: true, payment: true },
      });
      const event = await tx.paymentEvent.findUniqueOrThrow({ where: { id: eventId } });
      if (event.status !== PaymentEventStatus.RECEIVED) return this.toView(booking);
      if (
        booking.status === BookingStatus.CONFIRMED ||
        payment.status === PaymentStatus.SUCCEEDED
      ) {
        await this.markPaymentEvent(tx, eventId, PaymentEventStatus.IGNORED);
        return this.toView(booking);
      }

      const now = new Date();
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.REQUIRES_RECONCILIATION, reconciliationRequiredAt: now },
      });
      if (booking.status === BookingStatus.PENDING) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: BookingStatus.EXPIRED },
        });
      }
      await tx.paymentReconciliation.upsert({
        where: { paymentId },
        create: {
          paymentId,
          providerEventId: payload.id,
          reason: 'PAYMENT_CAPTURED_BUT_FULFILLMENT_FAILED',
          status: PaymentReconciliationStatus.OPEN,
        },
        update: { reason: 'PAYMENT_CAPTURED_BUT_FULFILLMENT_FAILED' },
      });
      await tx.auditLog.create({
        data: {
          action: 'PAYMENT_RECONCILIATION_REQUIRED',
          resourceType: 'Payment',
          resourceId: paymentId,
          metadata: {
            providerEventId: payload.id,
            reason: 'PAYMENT_CAPTURED_BUT_FULFILLMENT_FAILED',
            error: this.safeError(error),
          },
        },
      });
      await this.markPaymentEvent(tx, eventId, PaymentEventStatus.PROCESSED);
      return this.toView(await this.findBookingInTransaction(tx, booking.id));
    });
  }

  private isFulfillmentConflict(error: unknown): boolean {
    if (!(error instanceof ConflictException)) return false;
    const response = error.getResponse();
    if (typeof response !== 'object' || response === null) return false;
    const code = (response as { code?: unknown }).code;
    return code === 'SEAT_ALREADY_SOLD' || code === 'TICKET_CAPACITY_REACHED';
  }

  private async getSaleSnapshot(eventSessionId: string, seatIds: string[]) {
    const session = await this.prisma.eventSession.findUnique({
      where: { id: eventSessionId },
      include: {
        event: { select: { status: true } },
        allocations: {
          where: { seatId: { in: seatIds } },
          include: { seat: true, ticketType: true },
        },
      },
    });
    if (!session || session.event.status !== EventStatus.SALES_OPEN) {
      throw new ConflictException({ code: 'SALES_NOT_OPEN', message: 'Seat sales are not open' });
    }
    this.assertSaleSnapshot(session.allocations, seatIds);
    return this.saleSnapshotFromAllocations(session.allocations);
  }

  private saleSnapshotFromAllocations(
    allocations: Array<{
      ticketType: { priceMinor: number; currency: string } | null;
    }>,
  ): { currency: string; totalMinor: number } {
    const currency = allocations[0]?.ticketType?.currency ?? 'VND';
    const totalMinor = allocations.reduce(
      (sum, allocation) => sum + (allocation.ticketType?.priceMinor ?? 0),
      0,
    );
    if (allocations.some((allocation) => allocation.ticketType?.currency !== currency)) {
      throw new ConflictException({
        code: 'CURRENCY_MISMATCH',
        message: 'Ticket currencies must match',
      });
    }
    return { currency, totalMinor };
  }

  private assertSaleSnapshot(
    allocations: Array<{
      seatId: string;
      status: SeatAllocationStatus;
      ticketTypeId: string | null;
      ticketType: { id: string; name: string; priceMinor: number; currency: string } | null;
    }>,
    seatIds: string[],
  ): void {
    if (
      allocations.length !== seatIds.length ||
      allocations.some(
        (allocation) =>
          allocation.status !== SeatAllocationStatus.AVAILABLE || !allocation.ticketType,
      )
    ) {
      throw new ConflictException({
        code: 'SEAT_UNAVAILABLE',
        message: 'One or more seats are no longer available',
      });
    }
  }

  private async incrementTicketTypeCounts(
    tx: Prisma.TransactionClient,
    items: Array<{ ticketTypeId: string | null }>,
  ): Promise<void> {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (!item.ticketTypeId)
        throw new ConflictException({
          code: 'TICKET_TYPE_MISSING',
          message: 'Ticket type is missing',
        });
      counts.set(item.ticketTypeId, (counts.get(item.ticketTypeId) ?? 0) + 1);
    }
    for (const [ticketTypeId, count] of counts) {
      const updated = await tx.$executeRaw`
        UPDATE "ticket_types"
        SET "soldQuantity" = "soldQuantity" + ${count}, "updatedAt" = NOW()
        WHERE "id" = ${ticketTypeId}
          AND "soldQuantity" + ${count} <= "capacity"
      `;
      if (updated !== 1) {
        throw new ConflictException({
          code: 'TICKET_CAPACITY_REACHED',
          message: 'Ticket capacity has been reached',
        });
      }
    }
  }

  private async resolveHoldId(
    eventSessionId: string,
    userId: string,
    seatIds: string[],
    holdToken: string,
  ): Promise<string> {
    const hold = await this.seating.getHoldByToken(eventSessionId, userId, seatIds, holdToken);
    return hold.holdId;
  }

  private async ensureProviderPayment(
    bookingId: string,
    options: { allowExpiredRecovery?: boolean } = {},
  ): Promise<BookingView> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { items: true, payment: true },
    });
    if (!booking || !booking.payment)
      return booking ? this.toView(booking) : this.throwBookingNotFound();
    if (booking.payment.providerReference) return this.toView(booking);

    const now = new Date();
    const staleBefore = new Date(now.getTime() - PROVIDER_ATTEMPT_LEASE_MS);
    const expiredBooking = booking.status !== BookingStatus.PENDING || booking.expiresAt <= now;
    const staleProviderAttempt =
      booking.payment.status === PaymentStatus.PROCESSING &&
      (booking.payment.providerAttemptedAt === null ||
        booking.payment.providerAttemptedAt <= staleBefore);
    if (expiredBooking && !(options.allowExpiredRecovery === true && staleProviderAttempt)) {
      return this.toView(booking);
    }

    const providerAttemptId = randomUUID();
    const claim = await this.prisma.payment.updateMany({
      where: {
        id: booking.payment.id,
        providerReference: null,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
        OR: [{ providerAttemptedAt: null }, { providerAttemptedAt: { lt: staleBefore } }],
      },
      data: {
        status: PaymentStatus.PROCESSING,
        providerAttemptId,
        providerAttemptedAt: now,
        providerLastError: null,
      },
    });
    if (claim.count !== 1) return this.toView(booking);

    const claimedPayment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: booking.payment.id },
    });
    try {
      const created = await this.payments.create({
        bookingId,
        amountMinor: claimedPayment.amountMinor,
        currency: claimedPayment.currency,
        expiresAt: claimedPayment.expiresAt ?? booking.expiresAt,
        idempotencyKey: claimedPayment.providerIdempotencyKey,
      });
      await this.persistProviderPayment(bookingId, claimedPayment.id, providerAttemptId, created);
    } catch (error) {
      await this.recordProviderFailure(bookingId, claimedPayment.id, providerAttemptId, now, error);
    }

    const refreshed = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { items: true, payment: true },
    });
    return this.toView(refreshed);
  }

  private async persistProviderPayment(
    bookingId: string,
    paymentId: string,
    providerAttemptId: string,
    created: { providerReference: string; clientSecret: string; expiresAt: Date },
  ): Promise<void> {
    const now = new Date();
    const finalized = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "payments" AS payment
      SET
        "providerReference" = ${created.providerReference},
        "clientSecret" = ${created.clientSecret},
        "expiresAt" = ${created.expiresAt},
        "status" = 'PENDING'::"PaymentStatus",
        "providerAttemptId" = NULL,
        "providerAttemptedAt" = NULL,
        "providerLastError" = NULL,
        "updatedAt" = NOW()
      FROM "bookings" AS booking
      WHERE payment."id" = ${paymentId}
        AND payment."providerAttemptId" = ${providerAttemptId}::uuid
        AND payment."providerReference" IS NULL
        AND payment."status" = 'PROCESSING'::"PaymentStatus"
        AND booking."id" = payment."bookingId"
        AND booking."status" = 'PENDING'::"BookingStatus"
        AND booking."expiresAt" > ${now}
    `);
    if (finalized === 1) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id"
        FROM "bookings"
        WHERE "id" = ${bookingId}
        FOR UPDATE
      `);
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (payment.providerReference || payment.providerAttemptId !== providerAttemptId) return;
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      if (
        payment.status === PaymentStatus.PROCESSING &&
        booking.status === BookingStatus.PENDING &&
        booking.expiresAt > new Date()
      ) {
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            providerReference: created.providerReference,
            clientSecret: created.clientSecret,
            expiresAt: created.expiresAt,
            status: PaymentStatus.PENDING,
            providerAttemptId: null,
            providerAttemptedAt: null,
            providerLastError: null,
          },
        });
        return;
      }

      const now = new Date();
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          providerReference: created.providerReference,
          clientSecret: created.clientSecret,
          expiresAt: created.expiresAt,
          status: PaymentStatus.REQUIRES_RECONCILIATION,
          providerAttemptId: null,
          providerAttemptedAt: null,
          providerLastError: null,
          reconciliationRequiredAt: now,
        },
      });
      if (booking.status === BookingStatus.PENDING) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: BookingStatus.EXPIRED },
        });
      }
      await tx.paymentReconciliation.upsert({
        where: { paymentId },
        create: {
          paymentId,
          providerEventId: `provider-attempt:${providerAttemptId}`,
          reason: 'PROVIDER_RESPONSE_AFTER_BOOKING_TERMINAL',
          status: PaymentReconciliationStatus.OPEN,
        },
        update: { reason: 'PROVIDER_RESPONSE_AFTER_BOOKING_TERMINAL' },
      });
      await tx.auditLog.create({
        data: {
          action: 'PAYMENT_RECONCILIATION_REQUIRED',
          resourceType: 'Payment',
          resourceId: paymentId,
          metadata: {
            reason: 'PROVIDER_RESPONSE_AFTER_BOOKING_TERMINAL',
            providerAttemptId,
            providerReference: created.providerReference,
          },
        },
      });
    });
  }

  private async recordProviderFailure(
    bookingId: string,
    paymentId: string,
    providerAttemptId: string,
    attemptedAt: Date,
    error: unknown,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id"
        FROM "bookings"
        WHERE "id" = ${bookingId}
        FOR UPDATE
      `);
      const payment = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (payment.providerReference || payment.providerAttemptId !== providerAttemptId) return;
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
      const message = this.safeError(error);
      if (booking.status === BookingStatus.PENDING && booking.expiresAt > new Date()) {
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: PaymentStatus.PENDING,
            providerAttemptId: null,
            providerLastError: message,
            providerAttemptedAt: attemptedAt,
          },
        });
        return;
      }

      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.REQUIRES_RECONCILIATION,
          providerAttemptId: null,
          providerLastError: message,
          providerAttemptedAt: null,
          reconciliationRequiredAt: new Date(),
        },
      });
      if (booking.status === BookingStatus.PENDING) {
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.EXPIRED },
        });
      }
      await tx.paymentReconciliation.upsert({
        where: { paymentId },
        create: {
          paymentId,
          providerEventId: `provider-attempt:${providerAttemptId}`,
          reason: 'PROVIDER_ERROR_AFTER_BOOKING_TERMINAL',
          status: PaymentReconciliationStatus.OPEN,
        },
        update: { reason: 'PROVIDER_ERROR_AFTER_BOOKING_TERMINAL' },
      });
      await tx.auditLog.create({
        data: {
          action: 'PAYMENT_RECONCILIATION_REQUIRED',
          resourceType: 'Payment',
          resourceId: paymentId,
          metadata: {
            reason: 'PROVIDER_ERROR_AFTER_BOOKING_TERMINAL',
            providerAttemptId,
            error: message,
          },
        },
      });
    });
  }

  private async storeIdempotency(
    userId: string,
    key: string,
    requestFingerprint: string,
    response: BookingView,
    expiresAt: string,
  ): Promise<void> {
    // Do not freeze an initialization-in-progress response in the replay
    // record. A later retry must be able to recover the provider claim and
    // persist the completed payment details.
    if (!response.payment?.providerReference) return;
    const existing = await this.findIdempotent(userId, key);
    if (existing) {
      this.assertIdempotencyFingerprint(existing.requestFingerprint, requestFingerprint);
      await this.prisma.idempotencyRecord.update({
        where: { id: existing.id },
        data: {
          bookingId: response.id,
          responseStatus: 201,
          responseBody: response as unknown as Prisma.InputJsonValue,
          expiresAt: new Date(expiresAt),
        },
      });
      return;
    }

    await this.prisma.idempotencyRecord.create({
      data: {
        scope: BOOKING_IDEMPOTENCY_SCOPE,
        key: this.idempotencyKey(userId, key),
        userId,
        bookingId: response.id,
        requestFingerprint,
        responseStatus: 201,
        responseBody: response as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(expiresAt),
      },
    });
  }

  private async replayIdempotency(
    userId: string,
    key: string,
    record: Prisma.IdempotencyRecordGetPayload<object>,
  ): Promise<BookingView> {
    if (record.responseStatus === 201) return this.parseStoredResponse(record.responseBody);
    if (!record.bookingId) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS',
        message: 'The original checkout request is still being recovered',
      });
    }

    const booking = await this.findBooking(userId, record.bookingId);
    if (!booking) this.throwBookingNotFound();
    const response = await this.ensureProviderPayment(record.bookingId);
    if (response.payment?.providerReference) {
      await this.storeIdempotency(
        userId,
        key,
        record.requestFingerprint ?? '',
        response,
        response.expiresAt,
      );
    }
    return response;
  }

  private async findBooking(userId: string, bookingId: string): Promise<BookingWithDetails | null> {
    return this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
      include: { items: true, payment: true },
    });
  }

  private async findBookingInTransaction(
    tx: Prisma.TransactionClient,
    bookingId: string,
  ): Promise<BookingWithDetails> {
    return tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { items: true, payment: true },
    });
  }

  private async markLatePayment(
    tx: Prisma.TransactionClient,
    booking: BookingWithDetails,
    paymentId: string,
    eventId: string,
    payload: PaymentWebhookPayload,
  ): Promise<BookingView> {
    const now = new Date();
    const reason =
      booking.status === BookingStatus.PENDING
        ? 'LATE_PAYMENT_AFTER_HOLD_EXPIRY'
        : 'PAYMENT_AFTER_TERMINAL_BOOKING';
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.REQUIRES_RECONCILIATION,
        reconciliationRequiredAt: now,
      },
    });
    if (booking.status === BookingStatus.PENDING) {
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.EXPIRED },
      });
    }
    await tx.paymentReconciliation.upsert({
      where: { paymentId },
      create: {
        paymentId,
        providerEventId: payload.id,
        reason,
        status: PaymentReconciliationStatus.OPEN,
      },
      update: {},
    });
    await tx.auditLog.create({
      data: {
        action: 'PAYMENT_RECONCILIATION_REQUIRED',
        resourceType: 'Payment',
        resourceId: paymentId,
        metadata: {
          providerEventId: payload.id,
          eventId,
          reason,
          amountMinor: payload.amountMinor,
          currency: payload.currency,
        },
      },
    });
    await this.markPaymentEvent(tx, eventId, PaymentEventStatus.PROCESSED);
    return this.toView(await this.findBookingInTransaction(tx, booking.id));
  }

  private async expirePendingBookingInTransaction(
    tx: Prisma.TransactionClient,
    booking: BookingWithDetails,
    force = false,
  ): Promise<boolean> {
    if (booking.status !== BookingStatus.PENDING) return false;
    if (booking.payment?.status === PaymentStatus.SUCCEEDED) return false;
    if (!force && booking.expiresAt > new Date()) return false;

    await tx.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.EXPIRED },
    });
    if (booking.payment && booking.payment.status === PaymentStatus.PENDING) {
      await tx.payment.update({
        where: { id: booking.payment.id },
        data: { status: PaymentStatus.EXPIRED },
      });
    }
    return true;
  }

  private async markPaymentEvent(
    tx: Prisma.TransactionClient,
    eventId: string,
    status: PaymentEventStatus,
  ): Promise<void> {
    await tx.paymentEvent.update({
      where: { id: eventId },
      data: { status, processedAt: new Date() },
    });
  }

  private requestFingerprint(
    eventSessionId: string,
    seatIds: string[],
    holdToken: string,
    clientTotalMinor?: number,
  ): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          eventSessionId,
          seatIds: [...new Set(seatIds)].sort(),
          holdToken: holdToken.trim(),
          clientTotalMinor: clientTotalMinor ?? null,
        }),
      )
      .digest('hex');
  }

  private assertIdempotencyFingerprint(
    storedFingerprint: string | null,
    requestFingerprint: string | undefined,
  ): void {
    if (requestFingerprint && !storedFingerprint) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REQUIRES_NEW_REQUEST',
        message: 'This idempotency key predates request binding; use a new key',
      });
    }
    if (storedFingerprint && requestFingerprint && storedFingerprint !== requestFingerprint) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        message: 'This idempotency key was already used for a different booking request',
      });
    }
  }

  private assertBookingMatchesRequest(
    booking: BookingWithDetails,
    userId: string,
    eventSessionId: string,
    seatIds: string[],
    clientTotalMinor?: number,
  ): void {
    const existingSeats = booking.items.map((item) => item.seatId).sort();
    const requestedSeats = [...new Set(seatIds)].sort();
    if (
      booking.userId !== userId ||
      booking.eventSessionId !== eventSessionId ||
      existingSeats.length !== requestedSeats.length ||
      existingSeats.some((seatId, index) => seatId !== requestedSeats[index]) ||
      (clientTotalMinor !== undefined && clientTotalMinor !== booking.totalMinor)
    ) {
      throw new ConflictException({
        code: 'HOLD_ALREADY_CHECKED_OUT',
        message: 'This seat hold was already checked out with a different request',
      });
    }
  }

  private async enqueue(
    tx: Prisma.TransactionClient,
    bookingId: string,
    topic: string,
    payload: Record<string, string>,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        topic,
        aggregateType: 'Booking',
        aggregateId: bookingId,
        bookingId,
        payload,
      },
    });
  }

  private async findIdempotent(userId: string, key: string) {
    const record = await this.prisma.idempotencyRecord.findUnique({
      where: {
        scope_key: { scope: BOOKING_IDEMPOTENCY_SCOPE, key: this.idempotencyKey(userId, key) },
      },
    });
    if (!record) return null;
    if (record.expiresAt <= new Date()) {
      await this.prisma.idempotencyRecord.deleteMany({ where: { id: record.id } });
      return null;
    }
    return record;
  }

  private parseStoredResponse(value: Prisma.JsonValue): BookingView {
    return value as unknown as BookingView;
  }

  private toView(booking: BookingWithDetails): BookingView {
    return {
      id: booking.id,
      publicCode: booking.publicCode,
      eventSessionId: booking.eventSessionId,
      status: booking.status,
      currency: booking.currency,
      subtotalMinor: booking.subtotalMinor,
      feeMinor: booking.feeMinor,
      totalMinor: booking.totalMinor,
      expiresAt: booking.expiresAt.toISOString(),
      confirmedAt: booking.confirmedAt?.toISOString() ?? null,
      items: booking.items.map((item) => ({
        id: item.id,
        seatCode: item.seatCode,
        ticketTypeName: item.ticketTypeName,
        priceMinor: item.priceMinor,
        currency: item.currency,
      })),
      payment: booking.payment
        ? {
            providerReference: booking.payment.providerReference,
            status: booking.payment.status,
            amountMinor: booking.payment.amountMinor,
            currency: booking.payment.currency,
            clientSecret: booking.payment.clientSecret,
            expiresAt: booking.payment.expiresAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  private idempotencyKey(userId: string, key: string): string {
    return createHash('sha256').update(`${userId}:${key}`).digest('hex');
  }

  private publicCode(prefix: string): string {
    return `${prefix}-${randomBytes(8).toString('hex').toUpperCase()}`;
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private isHoldUnavailable(error: unknown): boolean {
    if (!(error instanceof ConflictException || error instanceof ForbiddenException)) return false;
    const response = error.getResponse();
    if (typeof response !== 'object' || response === null) return false;
    const code = (response as { code?: unknown }).code;
    return code === 'HOLD_EXPIRED' || code === 'HOLD_NOT_OWNED';
  }

  private safeError(error: unknown): string {
    return (error instanceof Error ? error.message : 'Unknown provider error').slice(0, 500);
  }

  private throwBookingNotFound(): never {
    throw new NotFoundException({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
  }

  private throwHoldExpired(): never {
    throw new ConflictException({ code: 'HOLD_EXPIRED', message: 'The seat hold has expired' });
  }
}
