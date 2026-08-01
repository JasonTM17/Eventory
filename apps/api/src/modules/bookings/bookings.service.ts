import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  BookingStatus,
  EventStatus,
  PaymentEventStatus,
  PaymentStatus,
  Prisma,
  SeatAllocationStatus,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { SeatingService } from '../seating/seating.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import type { PaymentWebhookPayload } from '../payments/payment-provider.js';

const BOOKING_IDEMPOTENCY_SCOPE = 'booking:create';
const BOOKING_TTL_MS = 10 * 60 * 1_000;

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
    providerReference: string;
    status: PaymentStatus;
    amountMinor: number;
    currency: string;
    clientSecret: string | null;
    expiresAt: string | null;
  } | null;
}

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
    },
  ): Promise<BookingView> {
    const normalizedKey = input.idempotencyKey?.trim();
    if (normalizedKey) {
      const existing = await this.findIdempotent(userId, normalizedKey);
      if (existing) return this.parseStoredResponse(existing.responseBody);
    }

    const hold = await this.seating.assertOwnedHold(
      input.eventSessionId,
      userId,
      input.seatIds,
      await this.resolveHoldId(input.eventSessionId, userId, input.seatIds, input.holdToken),
    );
    const source = await this.getSaleSnapshot(input.eventSessionId, input.seatIds);
    const bookingId = randomUUID();
    const expiresAt = new Date(
      Math.min(new Date(hold.expiresAt).getTime(), Date.now() + BOOKING_TTL_MS),
    );
    const payment = await this.payments.create({
      bookingId,
      amountMinor: source.totalMinor,
      currency: source.currency,
      expiresAt,
    });

    try {
      const booking = await this.prisma.$transaction(async (tx) => {
        const allocations = await tx.seatAllocation.findMany({
          where: {
            eventSessionId: input.eventSessionId,
            seatId: { in: input.seatIds },
          },
          include: { seat: true, ticketType: true },
        });
        this.assertSaleSnapshot(allocations, input.seatIds);
        const now = new Date();
        if (now >= expiresAt) this.throwHoldExpired();

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
                providerReference: payment.providerReference,
                status: PaymentStatus.PENDING,
                amountMinor: source.totalMinor,
                currency: source.currency,
                clientSecret: payment.clientSecret,
                expiresAt,
              },
            },
          },
          include: { items: true, payment: true },
        });

        const response = this.toView(created);
        if (normalizedKey) {
          await tx.idempotencyRecord.create({
            data: {
              scope: BOOKING_IDEMPOTENCY_SCOPE,
              key: this.idempotencyKey(userId, normalizedKey),
              userId,
              responseStatus: 201,
              responseBody: response as unknown as Prisma.InputJsonValue,
              expiresAt,
            },
          });
        }
        return created;
      });
      return this.toView(booking);
    } catch (error) {
      if (normalizedKey && this.isUniqueViolation(error)) {
        const existing = await this.findIdempotent(userId, normalizedKey);
        if (existing) return this.parseStoredResponse(existing.responseBody);
      }
      throw error;
    }
  }

  async get(userId: string, bookingId: string): Promise<BookingView> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
      include: { items: true, payment: true },
    });
    if (!booking)
      throw new NotFoundException({ code: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
    return this.toView(booking);
  }

  async handlePaymentWebhook(payload: PaymentWebhookPayload): Promise<BookingView> {
    const payment = await this.prisma.payment.findUnique({
      where: { providerReference: payload.reference },
      include: { booking: { include: { items: true, payment: true } } },
    });
    if (!payment) {
      throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' });
    }
    if (
      payment.amountMinor !== payload.amountMinor ||
      payment.currency !== payload.currency.trim().toUpperCase()
    ) {
      throw new ConflictException({
        code: 'PAYMENT_AMOUNT_MISMATCH',
        message: 'Payment amount or currency does not match the booking',
      });
    }

    if (payload.type === 'payment.succeeded') {
      await this.seating.assertOwnedHold(
        payment.booking.eventSessionId,
        payment.booking.userId,
        payment.booking.items.map((item) => item.seatId),
        payment.booking.holdId,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingEvent = await tx.paymentEvent.findUnique({
          where: { provider_providerEventId: { provider: 'MOCK', providerEventId: payload.id } },
        });
        if (existingEvent) {
          const current = await tx.booking.findUniqueOrThrow({
            where: { id: payment.bookingId },
            include: { items: true, payment: true },
          });
          return this.toView(current);
        }

        const event = await tx.paymentEvent.create({
          data: {
            paymentId: payment.id,
            provider: 'MOCK',
            providerEventId: payload.id,
            eventType: payload.type,
            payload: payload as unknown as Prisma.InputJsonValue,
          },
        });
        const booking = await tx.booking.findUniqueOrThrow({
          where: { id: payment.bookingId },
          include: { items: true, payment: true },
        });
        if (booking.status !== BookingStatus.PENDING || booking.expiresAt <= new Date()) {
          const status =
            booking.expiresAt <= new Date() ? BookingStatus.EXPIRED : BookingStatus.PAYMENT_FAILED;
          const paymentStatus =
            booking.expiresAt <= new Date() ? PaymentStatus.EXPIRED : PaymentStatus.FAILED;
          await tx.payment.update({ where: { id: payment.id }, data: { status: paymentStatus } });
          await tx.booking.update({ where: { id: booking.id }, data: { status } });
          await tx.paymentEvent.update({
            where: { id: event.id },
            data: { status: PaymentEventStatus.IGNORED, processedAt: new Date() },
          });
          return this.toView({
            ...booking,
            status,
            payment: { ...booking.payment!, status: paymentStatus },
          });
        }

        if (payload.type !== 'payment.succeeded') {
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
          await tx.paymentEvent.update({
            where: { id: event.id },
            data: { status: PaymentEventStatus.PROCESSED, processedAt: new Date() },
          });
          return this.toView({
            ...booking,
            status: BookingStatus.PAYMENT_FAILED,
            payment: { ...booking.payment!, status: PaymentStatus.FAILED },
          });
        }

        await this.seating.assertOwnedHold(
          booking.eventSessionId,
          booking.userId,
          booking.items.map((item) => item.seatId),
          booking.holdId,
        );
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
        const confirmed = await tx.booking.update({
          where: { id: booking.id },
          data: { status: BookingStatus.CONFIRMED, confirmedAt: new Date() },
          include: { items: true, payment: true },
        });
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.SUCCEEDED },
        });
        await this.enqueue(tx, booking.id, 'booking.confirmed', {
          bookingId: booking.id,
          publicCode: booking.publicCode,
        });
        await tx.paymentEvent.update({
          where: { id: event.id },
          data: { status: PaymentEventStatus.PROCESSED, processedAt: new Date() },
        });
        return this.toView({
          ...confirmed,
          payment: { ...confirmed.payment!, status: PaymentStatus.SUCCEEDED },
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const current = await this.prisma.booking.findUniqueOrThrow({
          where: { id: payment.bookingId },
          include: { items: true, payment: true },
        });
        return this.toView(current);
      }
      throw error;
    }
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
    return this.handlePaymentWebhook({
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
    const currency = session.allocations[0]?.ticketType?.currency ?? 'VND';
    const totalMinor = session.allocations.reduce(
      (sum, allocation) => sum + (allocation.ticketType?.priceMinor ?? 0),
      0,
    );
    if (session.allocations.some((allocation) => allocation.ticketType?.currency !== currency)) {
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
    return this.prisma.idempotencyRecord.findUnique({
      where: {
        scope_key: { scope: BOOKING_IDEMPOTENCY_SCOPE, key: this.idempotencyKey(userId, key) },
      },
    });
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

  private throwHoldExpired(): never {
    throw new ConflictException({ code: 'HOLD_EXPIRED', message: 'The seat hold has expired' });
  }
}
