import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationMemberRole, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';

type MetricWindow = { from: Date; to: Date };

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
  ) {}

  async eventMetrics(eventId: string, userId: string, input: { from?: string; to?: string }) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizationId: true, timezone: true },
    });
    if (!event)
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found' });
    await this.organizations.assertAccess(event.organizationId, userId, [
      OrganizationMemberRole.OWNER,
      OrganizationMemberRole.ADMIN,
      OrganizationMemberRole.STAFF,
    ]);

    const window = this.window(input);
    const eventSessionWhere = { eventSession: { eventId } } satisfies Prisma.BookingWhereInput;
    const [
      sessions,
      bookingStatuses,
      paymentStatuses,
      successfulPayments,
      currencies,
      issuedTickets,
      checkedInTickets,
    ] = await Promise.all([
      this.prisma.eventSession.count({ where: { eventId } }),
      this.prisma.booking.groupBy({
        by: ['status'],
        where: { ...eventSessionWhere, createdAt: { gte: window.from, lt: window.to } },
        _count: { _all: true },
      }),
      this.prisma.payment.groupBy({
        by: ['status'],
        where: { booking: eventSessionWhere, createdAt: { gte: window.from, lt: window.to } },
        _count: { _all: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          booking: eventSessionWhere,
          status: 'SUCCEEDED',
          createdAt: { gte: window.from, lt: window.to },
        },
        _count: { _all: true },
        _sum: { amountMinor: true },
      }),
      this.prisma.payment.findMany({
        where: {
          booking: eventSessionWhere,
          status: 'SUCCEEDED',
          createdAt: { gte: window.from, lt: window.to },
        },
        distinct: ['currency'],
        select: { currency: true },
      }),
      this.prisma.ticket.count({
        where: { eventSession: { eventId }, issuedAt: { gte: window.from, lt: window.to } },
      }),
      this.prisma.ticket.count({
        where: {
          eventSession: { eventId },
          status: 'CHECKED_IN',
          checkedInAt: { gte: window.from, lt: window.to },
        },
      }),
    ]);

    const bookings = this.statusCounts(bookingStatuses);
    const payments = this.statusCounts(paymentStatuses);
    return {
      eventId,
      timezone: event.timezone,
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      sessions,
      bookings: {
        total: Object.values(bookings).reduce((sum, value) => sum + value, 0),
        byStatus: bookings,
      },
      payments: {
        successfulCount: successfulPayments._count._all,
        grossMinor: successfulPayments._sum.amountMinor ?? 0,
        currencies: currencies.map((item) => item.currency),
        byStatus: payments,
      },
      attendance: {
        issued: issuedTickets,
        checkedIn: checkedInTickets,
        checkInRate: issuedTickets ? Number((checkedInTickets / issuedTickets).toFixed(4)) : 0,
      },
    };
  }

  private statusCounts(
    rows: Array<{ status: string; _count: { _all: number } }>,
  ): Record<string, number> {
    return rows.reduce<Record<string, number>>((result, row) => {
      result[row.status] = row._count._all;
      return result;
    }, {});
  }

  private window(input: { from?: string; to?: string }): MetricWindow {
    const to = input.to ? new Date(input.to) : new Date();
    const from = input.from ? new Date(input.from) : new Date(to.getTime() - 30 * 86_400_000);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) {
      throw new ConflictException({
        code: 'ANALYTICS_WINDOW_INVALID',
        message: 'Analytics date range is invalid',
      });
    }
    if (to.getTime() - from.getTime() > 366 * 86_400_000) {
      throw new ConflictException({
        code: 'ANALYTICS_WINDOW_TOO_LARGE',
        message: 'Analytics range cannot exceed one year',
      });
    }
    return { from, to };
  }
}
