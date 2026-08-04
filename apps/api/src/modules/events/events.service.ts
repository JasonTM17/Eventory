import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EventStatus, OrganizationMemberRole, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { assertEventTransition } from './event-lifecycle.js';

type PublicEvent = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  timezone: string;
  startAt: Date;
  endAt: Date;
  status: EventStatus;
  venue: { id: string; name: string; address: string | null } | null;
  sessions: { id: string; name: string; startAt: Date; endAt: Date }[];
  ticketTypes: {
    id: string;
    name: string;
    description: string | null;
    priceMinor: number;
    currency: string;
  }[];
};

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
  ) {}

  async create(input: {
    organizationId: string;
    userId: string;
    venueId?: string;
    name: string;
    description?: string;
    startAt: string;
    endAt: string;
    timezone?: string;
  }): Promise<unknown> {
    await this.organizations.assertAccess(input.organizationId, input.userId);
    const startAt = this.parseDate(input.startAt);
    const endAt = this.parseDate(input.endAt);
    this.assertDateRange(startAt, endAt);
    if (input.venueId) {
      const venue = await this.prisma.venue.findFirst({
        where: { id: input.venueId, organizationId: input.organizationId },
        select: { id: true },
      });
      if (!venue)
        throw new NotFoundException({ code: 'VENUE_NOT_FOUND', message: 'Venue not found' });
    }

    try {
      const event = await this.prisma.event.create({
        data: {
          organizationId: input.organizationId,
          ...(input.venueId ? { venueId: input.venueId } : {}),
          name: input.name.trim(),
          slug: await this.uniqueSlug(input.name),
          ...(input.description ? { description: input.description.trim() } : {}),
          timezone: input.timezone?.trim() || 'UTC',
          startAt,
          endAt,
        },
      });
      return this.toEventView(event);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'EVENT_SLUG_CONFLICT',
          message: 'Event slug already exists',
        });
      }
      throw error;
    }
  }

  async update(
    eventId: string,
    input: { userId: string; name?: string; description?: string },
  ): Promise<unknown> {
    const event = await this.getManagedEvent(eventId, input.userId);
    if (event.status !== EventStatus.DRAFT && event.status !== EventStatus.PUBLISHED) {
      throw new ConflictException({
        code: 'EVENT_IMMUTABLE_AFTER_SALES',
        message: 'Event details cannot be changed after sales open',
      });
    }
    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.description === undefined ? {} : { description: input.description.trim() }),
      },
    });
    return this.toEventView(updated);
  }

  async addSession(
    eventId: string,
    input: {
      userId: string;
      name: string;
      startAt: string;
      endAt: string;
      salesStartAt: string;
      salesEndAt: string;
    },
  ): Promise<unknown> {
    const event = await this.getManagedEvent(eventId, input.userId);
    this.assertDraftLike(event.status);
    const dates = {
      startAt: this.parseDate(input.startAt),
      endAt: this.parseDate(input.endAt),
      salesStartAt: this.parseDate(input.salesStartAt),
      salesEndAt: this.parseDate(input.salesEndAt),
    };
    this.assertDateRange(dates.startAt, dates.endAt);
    this.assertDateRange(dates.salesStartAt, dates.salesEndAt);
    if (dates.salesEndAt > dates.startAt || dates.salesStartAt >= dates.startAt) {
      throw new ConflictException({
        code: 'SESSION_SALES_WINDOW_INVALID',
        message: 'Sales must end before the session starts',
      });
    }
    return this.prisma.eventSession.create({
      data: { eventId, name: input.name.trim(), ...dates },
      select: {
        id: true,
        eventId: true,
        name: true,
        startAt: true,
        endAt: true,
        salesStartAt: true,
        salesEndAt: true,
      },
    });
  }

  async addTicketType(
    eventId: string,
    input: {
      userId: string;
      name: string;
      description?: string;
      priceMinor: number;
      currency?: string;
      capacity: number;
    },
  ): Promise<unknown> {
    const event = await this.getManagedEvent(eventId, input.userId);
    this.assertDraftLike(event.status);
    try {
      return await this.prisma.ticketType.create({
        data: {
          eventId,
          name: input.name.trim(),
          ...(input.description ? { description: input.description.trim() } : {}),
          priceMinor: input.priceMinor,
          currency: input.currency?.trim().toUpperCase() || 'VND',
          capacity: input.capacity,
        },
        select: {
          id: true,
          eventId: true,
          name: true,
          description: true,
          priceMinor: true,
          currency: true,
          capacity: true,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'TICKET_TYPE_EXISTS',
          message: 'Ticket type already exists',
        });
      }
      throw error;
    }
  }

  async transition(eventId: string, userId: string, target: EventStatus): Promise<unknown> {
    const event = await this.getManagedEventWithInventory(eventId, userId);
    assertEventTransition(event.status, target);
    if (target === EventStatus.PUBLISHED) {
      if (!event.sessions.length || !event.ticketTypes.length) {
        throw new ConflictException({
          code: 'EVENT_MISSING_INVENTORY',
          message: 'Event needs a session and ticket type before publishing',
        });
      }
      if (
        event.sessions.some(
          (session) => session.startAt <= new Date() || session.endAt <= session.startAt,
        )
      ) {
        throw new ConflictException({
          code: 'EVENT_SESSION_INVALID',
          message: 'Event session dates are invalid',
        });
      }
    }
    if (target === EventStatus.SALES_OPEN && event.startAt <= new Date()) {
      throw new ConflictException({
        code: 'EVENT_ALREADY_STARTED',
        message: 'Sales cannot open after the event has started',
      });
    }
    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        status: target,
        ...(target === EventStatus.PUBLISHED ? { publishedAt: new Date() } : {}),
      },
    });
    return this.toEventView(updated);
  }

  async listPublic(page = 1, pageSize = 20, search?: string): Promise<unknown> {
    const safePage = this.normalizePage(page, 1);
    const safePageSize = this.normalizePage(pageSize, 20, 100);
    const where: Prisma.EventWhereInput = {
      endAt: { gte: new Date() },
      status: {
        in: [
          EventStatus.PUBLISHED,
          EventStatus.SALES_OPEN,
          EventStatus.SALES_CLOSED,
          EventStatus.ONGOING,
        ],
      },
      ...(search ? { name: { contains: search.trim(), mode: 'insensitive' } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        orderBy: { startAt: 'asc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        include: this.publicInclude,
      }),
      this.prisma.event.count({ where }),
    ]);
    return {
      items: items.map((item) => this.toPublicEvent(item)),
      page: safePage,
      pageSize: safePageSize,
      total,
      pageCount: Math.ceil(total / safePageSize),
    };
  }

  async getPublic(eventIdOrSlug: string): Promise<PublicEvent> {
    const where: Prisma.EventWhereInput = {
      status: { notIn: [EventStatus.DRAFT, EventStatus.CANCELLED] },
      ...(this.isUuid(eventIdOrSlug)
        ? { id: eventIdOrSlug }
        : { slug: eventIdOrSlug.toLowerCase() }),
    };
    const event = await this.prisma.event.findFirst({
      where,
      include: this.publicInclude,
    });
    if (!event)
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    return this.toPublicEvent(event);
  }

  private readonly publicInclude = {
    venue: { select: { id: true, name: true, address: true } },
    sessions: {
      select: { id: true, name: true, startAt: true, endAt: true },
      orderBy: { startAt: 'asc' as const },
    },
    ticketTypes: {
      select: { id: true, name: true, description: true, priceMinor: true, currency: true },
      orderBy: { priceMinor: 'asc' as const },
    },
  } as const;

  private async getManagedEvent(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event)
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    await this.organizations.assertAccess(event.organizationId, userId, [
      OrganizationMemberRole.OWNER,
      OrganizationMemberRole.ADMIN,
      OrganizationMemberRole.STAFF,
    ]);
    return event;
  }

  private async getManagedEventWithInventory(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { sessions: true, ticketTypes: true },
    });
    if (!event)
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    await this.organizations.assertAccess(event.organizationId, userId, [
      OrganizationMemberRole.OWNER,
      OrganizationMemberRole.ADMIN,
      OrganizationMemberRole.STAFF,
    ]);
    return event;
  }

  private assertDraftLike(status: EventStatus): void {
    if (status !== EventStatus.DRAFT && status !== EventStatus.PUBLISHED) {
      throw new ConflictException({
        code: 'EVENT_IMMUTABLE_AFTER_SALES',
        message: 'Event inventory cannot be changed after sales open',
      });
    }
  }

  private parseDate(value: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
      throw new ConflictException({ code: 'INVALID_DATE', message: 'Date value is invalid' });
    return parsed;
  }

  private assertDateRange(startAt: Date, endAt: Date): void {
    if (endAt <= startAt)
      throw new ConflictException({
        code: 'INVALID_DATE_RANGE',
        message: 'End date must be after start date',
      });
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 210);
    const slug = base || `event-${randomSuffix()}`;
    const exists = await this.prisma.event.findUnique({ where: { slug }, select: { id: true } });
    return exists ? `${slug}-${randomSuffix()}` : slug;
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private normalizePage(value: number, fallback: number, max = 1_000_000): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) return fallback;
    return Math.min(parsed, max);
  }

  private toEventView(event: {
    id: string;
    organizationId: string;
    name: string;
    slug: string;
    description: string | null;
    timezone: string;
    startAt: Date;
    endAt: Date;
    status: EventStatus;
  }) {
    return {
      id: event.id,
      organizationId: event.organizationId,
      name: event.name,
      slug: event.slug,
      description: event.description,
      timezone: event.timezone,
      startAt: event.startAt,
      endAt: event.endAt,
      status: event.status,
    };
  }

  private toPublicEvent(event: PublicEvent): PublicEvent {
    return event;
  }
}

function randomSuffix(): string {
  return randomUUID().replaceAll('-', '').slice(0, 8);
}
