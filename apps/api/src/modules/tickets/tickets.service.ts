import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TicketStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { TicketQrService } from './ticket-qr.service.js';

export type TicketView = {
  id: string;
  publicCode: string;
  status: TicketStatus;
  eventSessionId: string;
  event: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  session: {
    id: string;
    name: string;
    startAt: string;
    endAt: string;
  };
  seatCode: string | null;
  ticketTypeName: string;
  priceMinor: number;
  currency: string;
  issuedAt: string;
  checkedInAt: string | null;
  qrPayload: string;
};

type TicketWithDetails = Prisma.TicketGetPayload<{
  include: {
    bookingItem: true;
    eventSession: {
      include: { event: { select: { id: true; name: true; slug: true; status: true } } };
    };
  };
}>;

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qr: TicketQrService,
  ) {}

  async listForUser(userId: string): Promise<TicketView[]> {
    const tickets = await this.prisma.ticket.findMany({
      where: { userId },
      include: {
        bookingItem: true,
        eventSession: {
          include: { event: { select: { id: true, name: true, slug: true, status: true } } },
        },
      },
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
    });
    return tickets.map((ticket) => this.toView(ticket));
  }

  async getForUser(userId: string, publicCode: string): Promise<TicketView> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { userId, publicCode: publicCode.trim().toUpperCase() },
      include: {
        bookingItem: true,
        eventSession: {
          include: { event: { select: { id: true, name: true, slug: true, status: true } } },
        },
      },
    });
    if (!ticket) {
      throw new NotFoundException({ code: 'TICKET_NOT_FOUND', message: 'Ticket not found' });
    }
    return this.toView(ticket);
  }

  private toView(ticket: TicketWithDetails): TicketView {
    return {
      id: ticket.id,
      publicCode: ticket.publicCode,
      status: ticket.status,
      eventSessionId: ticket.eventSessionId,
      event: {
        id: ticket.eventSession.event.id,
        name: ticket.eventSession.event.name,
        slug: ticket.eventSession.event.slug,
        status: ticket.eventSession.event.status,
      },
      session: {
        id: ticket.eventSession.id,
        name: ticket.eventSession.name,
        startAt: ticket.eventSession.startAt.toISOString(),
        endAt: ticket.eventSession.endAt.toISOString(),
      },
      seatCode: ticket.bookingItem.seatCode,
      ticketTypeName: ticket.bookingItem.ticketTypeName,
      priceMinor: ticket.bookingItem.priceMinor,
      currency: ticket.bookingItem.currency,
      issuedAt: ticket.issuedAt.toISOString(),
      checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
      qrPayload: this.qr.createPayload({
        publicCode: ticket.publicCode,
        eventSessionId: ticket.eventSessionId,
        qrNonce: ticket.qrNonce,
        qrKeyVersion: ticket.qrKeyVersion,
      }),
    };
  }
}
