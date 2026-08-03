import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { EventStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { RedisService } from '../../infrastructure/redis/redis.service.js';
import { SeatingGateway } from './seating.gateway.js';
import {
  ACQUIRE_HOLDS_SCRIPT,
  RELEASE_HOLDS_SCRIPT,
  RENEW_HOLDS_SCRIPT,
  SEAT_HOLD_PREFIX,
  seatHoldKey,
  seatHoldRequestKey,
} from './seat-hold.constants.js';

interface HoldRecord {
  token: string;
  holdId: string;
  userId: string;
  eventSessionId: string;
  seatId: string;
  seatIds?: string[];
  expiresAt: number;
}

interface HoldResponse {
  holdId: string;
  holdToken: string;
  eventSessionId: string;
  seatIds: string[];
  expiresAt: string;
}

export interface OwnedHold {
  holdId: string;
  eventSessionId: string;
  seatIds: string[];
  expiresAt: string;
}

@Injectable()
export class SeatingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SeatingService.name);
  private readonly ttlMs: number;
  private removeExpirationListener?: () => void;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gateway: SeatingGateway,
    config: ConfigService,
  ) {
    this.ttlMs = config.getOrThrow<number>('SEAT_HOLD_TTL_SECONDS') * 1_000;
  }

  onModuleInit(): void {
    this.removeExpirationListener = this.redis.onExpired((key) => {
      const parsed = this.parseHoldKey(key);
      if (!parsed) return;
      void this.publishPersistentSeatStates(parsed.eventSessionId, [parsed.seatId]).catch(
        (error) => {
          this.logger.warn(
            `Could not publish expired seat state for ${parsed.seatId}: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          );
        },
      );
    });
  }

  onModuleDestroy(): void {
    this.removeExpirationListener?.();
  }

  async availability(eventSessionId: string): Promise<{
    eventSessionId: string;
    event: { id: string; name: string; status: EventStatus; timezone: string };
    seats: Array<{
      seatId: string;
      sectionId: string;
      sectionName: string;
      rowLabel: string;
      seatNumber: number;
      code: string;
      status: 'available' | 'blocked' | 'sold' | 'held';
      holdExpiresAt: string | null;
      ticketTypeId: string | null;
    }>;
  }> {
    const session = await this.findSession(eventSessionId);
    if (
      session.event.status === EventStatus.DRAFT ||
      session.event.status === EventStatus.CANCELLED
    ) {
      throw new NotFoundException({
        code: 'EVENT_SESSION_NOT_FOUND',
        message: 'Event session not found',
      });
    }
    const keys = session.allocations.map((allocation) =>
      seatHoldKey(eventSessionId, allocation.seatId),
    );
    const values = await this.redis.mget(keys);
    return {
      eventSessionId,
      event: session.event,
      seats: session.allocations.map((allocation, index) => {
        const hold = this.parseHold(values[index]);
        const persistentStatus = allocation.status.toLowerCase() as
          'available' | 'blocked' | 'sold';
        const activeHold = hold && hold.expiresAt > Date.now() ? hold : undefined;
        const isAvailableHold = persistentStatus === 'available' && activeHold;
        return {
          seatId: allocation.seatId,
          sectionId: allocation.seat.sectionId,
          sectionName: allocation.seat.section.name,
          rowLabel: allocation.seat.rowLabel,
          seatNumber: allocation.seat.seatNumber,
          code: allocation.seat.code,
          status: isAvailableHold ? 'held' : persistentStatus,
          holdExpiresAt: isAvailableHold ? new Date(activeHold.expiresAt).toISOString() : null,
          ticketTypeId: allocation.ticketTypeId,
        };
      }),
    };
  }

  async assertOwnedHold(
    eventSessionId: string,
    userId: string,
    seatIds: string[],
    holdId: string,
  ): Promise<OwnedHold> {
    this.assertUuid(eventSessionId, 'EVENT_SESSION_INVALID');
    this.assertUuid(holdId, 'HOLD_INVALID');
    const normalizedSeatIds = this.normalizeSeatIds(seatIds);
    const values = await this.redis.mget(
      normalizedSeatIds.map((seatId) => seatHoldKey(eventSessionId, seatId)),
    );
    const holds = values.map((value) => this.parseHold(value));
    if (holds.some((hold) => !hold || hold.expiresAt <= Date.now())) this.holdExpired();
    if (
      holds.some(
        (hold) =>
          hold?.userId !== userId ||
          hold.holdId !== holdId ||
          hold.eventSessionId !== eventSessionId,
      )
    ) {
      throw this.holdOwnershipDenied();
    }
    this.assertWholeHold(holds, normalizedSeatIds);
    const expiresAt = Math.min(...holds.map((hold) => hold?.expiresAt ?? Date.now()));
    return {
      holdId,
      eventSessionId,
      seatIds: normalizedSeatIds,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  async getHoldByToken(
    eventSessionId: string,
    userId: string,
    seatIds: string[],
    holdToken: string,
  ): Promise<OwnedHold> {
    this.assertUuid(eventSessionId, 'EVENT_SESSION_INVALID');
    const normalizedSeatIds = this.normalizeSeatIds(seatIds);
    const values = await this.redis.mget(
      normalizedSeatIds.map((seatId) => seatHoldKey(eventSessionId, seatId)),
    );
    const holds = values.map((value) => this.parseHold(value));
    if (holds.some((hold) => !hold || hold.expiresAt <= Date.now())) this.holdExpired();
    if (
      holds.some(
        (hold) =>
          hold?.userId !== userId ||
          hold.token !== holdToken ||
          hold.eventSessionId !== eventSessionId,
      )
    ) {
      throw this.holdOwnershipDenied();
    }
    this.assertWholeHold(holds, normalizedSeatIds);
    const first = holds[0];
    if (!first) this.holdExpired();
    return {
      holdId: first.holdId,
      eventSessionId,
      seatIds: normalizedSeatIds,
      expiresAt: new Date(
        Math.min(...holds.map((hold) => hold?.expiresAt ?? Date.now())),
      ).toISOString(),
    };
  }

  async hold(
    eventSessionId: string,
    userId: string,
    seatIds: string[],
    idempotencyKey?: string,
  ): Promise<HoldResponse> {
    this.assertUuid(eventSessionId, 'EVENT_SESSION_INVALID');
    const normalizedSeatIds = this.normalizeSeatIds(seatIds);
    const session = await this.findSession(eventSessionId);
    const now = new Date();
    if (
      session.event.status !== EventStatus.SALES_OPEN ||
      now < session.salesStartAt ||
      now > session.salesEndAt
    ) {
      throw new ConflictException({
        code: 'SALES_NOT_OPEN',
        message: 'Seat sales are not open for this session',
      });
    }
    const allocations = session.allocations.filter((allocation) =>
      normalizedSeatIds.includes(allocation.seatId),
    );
    if (allocations.length !== normalizedSeatIds.length) {
      throw new ConflictException({
        code: 'SEAT_NOT_FOUND',
        message: 'One or more seats are not available for this session',
      });
    }
    if (allocations.some((allocation) => allocation.status !== 'AVAILABLE')) {
      throw new ConflictException({
        code: 'SEAT_UNAVAILABLE',
        message: 'One or more seats are no longer available',
      });
    }

    const requestKey = idempotencyKey?.trim()
      ? seatHoldRequestKey(userId, this.safeKey(idempotencyKey.trim()))
      : undefined;
    if (requestKey) {
      const existing = await this.redis.get(requestKey);
      const response = this.parseHoldResponse(existing);
      if (response && (await this.holdKeysExist(response))) return response;
      if (existing) await this.redis.delete([requestKey]);
    }

    const holdId = randomUUID();
    const holdToken = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + this.ttlMs;
    const keys = normalizedSeatIds.map((seatId) => seatHoldKey(eventSessionId, seatId));
    const value = JSON.stringify({
      token: holdToken,
      holdId,
      userId,
      eventSessionId,
      seatIds: normalizedSeatIds,
      expiresAt,
    } satisfies Omit<HoldRecord, 'seatId'>);
    const acquired = await this.redis.evaluate(ACQUIRE_HOLDS_SCRIPT, keys, [
      value,
      String(this.ttlMs),
    ]);
    if (acquired !== 1) {
      throw new ConflictException({
        code: 'SEAT_ALREADY_HELD',
        message: 'One or more seats are already held',
      });
    }
    const response: HoldResponse = {
      holdId,
      holdToken,
      eventSessionId,
      seatIds: normalizedSeatIds,
      expiresAt: new Date(expiresAt).toISOString(),
    };
    if (requestKey) await this.redis.setWithTtl(requestKey, JSON.stringify(response), this.ttlMs);
    this.gateway.publishSeatChange(eventSessionId, normalizedSeatIds, 'held', response.expiresAt);
    return response;
  }

  async release(
    eventSessionId: string,
    userId: string,
    seatIds: string[],
    holdToken: string,
  ): Promise<{ released: boolean }> {
    this.assertUuid(eventSessionId, 'EVENT_SESSION_INVALID');
    const normalizedSeatIds = this.normalizeSeatIds(seatIds);
    const keys = normalizedSeatIds.map((seatId) => seatHoldKey(eventSessionId, seatId));
    const existing = (await this.redis.mget(keys)).map((value) => this.parseHold(value));
    if (existing.every((hold) => !hold)) return { released: false };
    if (existing.some((hold) => !hold || hold.expiresAt <= Date.now())) this.holdExpired();
    this.assertWholeHold(existing, normalizedSeatIds);
    const result = await this.redis.evaluate(RELEASE_HOLDS_SCRIPT, keys, [holdToken, userId]);
    if (result === -1) throw this.holdOwnershipDenied();
    if (result === 1) {
      await this.publishPersistentSeatStates(eventSessionId, normalizedSeatIds);
      return { released: true };
    }
    return { released: false };
  }

  async renew(
    eventSessionId: string,
    userId: string,
    seatIds: string[],
    holdToken: string,
  ): Promise<HoldResponse> {
    this.assertUuid(eventSessionId, 'EVENT_SESSION_INVALID');
    const normalizedSeatIds = this.normalizeSeatIds(seatIds);
    const expiresAt = Date.now() + this.ttlMs;
    const keys = normalizedSeatIds.map((seatId) => seatHoldKey(eventSessionId, seatId));
    const existing = await this.redis.mget(keys);
    const holds = existing.map((value) => this.parseHold(value));
    const first = holds[0];
    if (!first) return this.holdExpired();
    this.assertWholeHold(holds, normalizedSeatIds);
    const value = JSON.stringify({ ...first, holdId: first.holdId, expiresAt });
    const result = await this.redis.evaluate(RENEW_HOLDS_SCRIPT, keys, [
      holdToken,
      userId,
      value,
      String(this.ttlMs),
    ]);
    if (result === -1) throw this.holdOwnershipDenied();
    if (result !== 1) return this.holdExpired();
    const response: HoldResponse = {
      holdId: first.holdId,
      holdToken,
      eventSessionId,
      seatIds: normalizedSeatIds,
      expiresAt: new Date(expiresAt).toISOString(),
    };
    this.gateway.publishSeatChange(eventSessionId, normalizedSeatIds, 'held', response.expiresAt);
    return response;
  }

  async releaseConfirmedHold(eventSessionId: string, seatIds: string[]): Promise<void> {
    this.assertUuid(eventSessionId, 'EVENT_SESSION_INVALID');
    const normalizedSeatIds = this.normalizeSeatIds(seatIds);
    await this.redis.delete(normalizedSeatIds.map((seatId) => seatHoldKey(eventSessionId, seatId)));
    this.gateway.publishSeatChange(eventSessionId, normalizedSeatIds, 'sold');
  }

  private async findSession(eventSessionId: string) {
    if (!this.isUuid(eventSessionId)) {
      throw new NotFoundException({
        code: 'EVENT_SESSION_NOT_FOUND',
        message: 'Event session not found',
      });
    }
    const session = await this.prisma.eventSession.findUnique({
      where: { id: eventSessionId },
      include: {
        event: { select: { id: true, name: true, status: true, timezone: true } },
        allocations: {
          include: { seat: { include: { section: true } } },
          orderBy: [
            { seat: { section: { sortOrder: 'asc' } } },
            { seat: { rowLabel: 'asc' } },
            { seat: { seatNumber: 'asc' } },
          ],
        },
      },
    });
    if (!session)
      throw new NotFoundException({
        code: 'EVENT_SESSION_NOT_FOUND',
        message: 'Event session not found',
      });
    return session;
  }

  private async holdKeysExist(response: HoldResponse): Promise<boolean> {
    const values = await this.redis.mget(
      response.seatIds.map((seatId) => seatHoldKey(response.eventSessionId, seatId)),
    );
    return values.every((value) => this.parseHold(value)?.token === response.holdToken);
  }

  private normalizeSeatIds(seatIds: string[]): string[] {
    const unique = [...new Set(seatIds)];
    if (!unique.length || unique.length > 12 || unique.some((seatId) => !this.isUuid(seatId))) {
      throw new ConflictException({
        code: 'SEAT_SELECTION_INVALID',
        message: 'Seat selection is invalid',
      });
    }
    return unique;
  }

  private parseHold(value: string | null | undefined): HoldRecord | undefined {
    if (!value) return undefined;
    try {
      const parsed = JSON.parse(value) as Partial<HoldRecord>;
      if (
        typeof parsed.token !== 'string' ||
        typeof parsed.userId !== 'string' ||
        typeof parsed.expiresAt !== 'number'
      )
        return undefined;
      if (
        parsed.seatIds !== undefined &&
        (!Array.isArray(parsed.seatIds) ||
          parsed.seatIds.some((seatId) => typeof seatId !== 'string'))
      ) {
        return undefined;
      }
      return parsed as HoldRecord;
    } catch {
      return undefined;
    }
  }

  private parseHoldResponse(value: string | null): HoldResponse | undefined {
    if (!value) return undefined;
    try {
      const parsed = JSON.parse(value) as HoldResponse;
      return parsed.holdId && parsed.holdToken && parsed.eventSessionId && parsed.seatIds?.length
        ? parsed
        : undefined;
    } catch {
      return undefined;
    }
  }

  private parseHoldKey(key: string): { eventSessionId: string; seatId: string } | undefined {
    if (!key.startsWith(SEAT_HOLD_PREFIX)) return undefined;
    const parts = key.slice(SEAT_HOLD_PREFIX.length).split(':');
    if (parts.length !== 2 || !this.isUuid(parts[0] ?? '') || !this.isUuid(parts[1] ?? ''))
      return undefined;
    return { eventSessionId: parts[0] as string, seatId: parts[1] as string };
  }

  private async publishPersistentSeatStates(
    eventSessionId: string,
    seatIds: string[],
  ): Promise<void> {
    const allocations = await this.prisma.seatAllocation.findMany({
      where: { eventSessionId, seatId: { in: seatIds } },
      select: { seatId: true, status: true },
    });
    const byState = new Map<'available' | 'blocked' | 'sold', string[]>();
    for (const allocation of allocations) {
      const state = allocation.status.toLowerCase() as 'available' | 'blocked' | 'sold';
      byState.set(state, [...(byState.get(state) ?? []), allocation.seatId]);
    }
    for (const [state, ids] of byState) this.gateway.publishSeatChange(eventSessionId, ids, state);
  }

  private safeKey(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private assertWholeHold(holds: Array<HoldRecord | undefined>, requestedSeatIds: string[]): void {
    const first = holds.find(Boolean);
    if (!first?.seatIds) return;
    const expected = [...new Set(first.seatIds)].sort();
    const requested = [...new Set(requestedSeatIds)].sort();
    if (
      expected.length !== requested.length ||
      expected.some((seatId, index) => seatId !== requested[index])
    ) {
      throw new ConflictException({
        code: 'HOLD_MUST_BE_CHECKED_OUT_AS_A_UNIT',
        message: 'All seats in a hold must be used together',
      });
    }
  }

  private assertUuid(value: string, code: string): void {
    if (!this.isUuid(value))
      throw new ConflictException({ code, message: 'Identifier is invalid' });
  }
  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }
  private holdOwnershipDenied(): ForbiddenException {
    return new ForbiddenException({
      code: 'HOLD_NOT_OWNED',
      message: 'This seat hold belongs to another session',
    });
  }
  private holdExpired(): never {
    throw new ConflictException({ code: 'HOLD_EXPIRED', message: 'The seat hold has expired' });
  }
}
