import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { OrganizationMemberRole, Prisma, TicketStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { TicketQrService } from '../tickets/ticket-qr.service.js';
import type { CheckInDto } from './check-in.dto.js';

export type CheckInResult =
  'VALID' | 'ALREADY_CHECKED_IN' | 'TICKET_VOID' | 'TICKET_REFUNDED' | 'EVENT_CANCELLED';

export type CheckInResponse = {
  result: CheckInResult;
  ticketCode: string;
  ticketStatus: TicketStatus;
  eventSessionId: string;
  checkedInAt: string | null;
};

type TicketForCheckIn = Prisma.TicketGetPayload<{
  include: {
    eventSession: { include: { event: { select: { organizationId: true; status: true } } } };
  };
}>;

@Injectable()
export class CheckInService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qr: TicketQrService,
    private readonly organizations: OrganizationsService,
  ) {}

  async check(scannerUserId: string, input: CheckInDto): Promise<CheckInResponse> {
    const verified = this.qr.verifyPayload(input.qrPayload);
    if (!verified) this.invalidQr();

    const ticket = await this.prisma.ticket.findUnique({
      where: { publicCode: verified.publicCode },
      include: {
        eventSession: { include: { event: { select: { organizationId: true, status: true } } } },
      },
    });
    if (!ticket || !this.matchesQr(ticket, verified)) this.invalidQr();

    await this.organizations.assertAccess(ticket.eventSession.event.organizationId, scannerUserId, [
      OrganizationMemberRole.OWNER,
      OrganizationMemberRole.ADMIN,
      OrganizationMemberRole.STAFF,
    ]);

    if (input.eventSessionId && input.eventSessionId !== ticket.eventSessionId) {
      throw new ConflictException({
        code: 'WRONG_EVENT',
        message: 'This ticket does not belong to the selected event session',
      });
    }

    if (ticket.eventSession.event.status === 'CANCELLED') {
      return this.toResponse('EVENT_CANCELLED', ticket);
    }
    if (ticket.status !== TicketStatus.ISSUED) {
      return this.toResponseForStatus(ticket);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const checkedInAt = new Date();
        const updated = await tx.ticket.updateMany({
          where: { id: ticket.id, status: TicketStatus.ISSUED },
          data: { status: TicketStatus.CHECKED_IN, checkedInAt },
        });

        if (updated.count === 0) {
          const current = await tx.ticket.findUnique({
            where: { id: ticket.id },
            include: {
              eventSession: {
                include: { event: { select: { organizationId: true, status: true } } },
              },
            },
          });
          if (!current) this.invalidQr();
          return this.toResponseForStatus(current);
        }

        await tx.ticketCheckIn.create({
          data: {
            ticketId: ticket.id,
            eventSessionId: ticket.eventSessionId,
            scannerUserId,
            checkedInAt,
          },
        });
        await tx.auditLog.create({
          data: {
            action: 'TICKET_CHECKED_IN',
            resourceType: 'Ticket',
            resourceId: ticket.id,
            actorUserId: scannerUserId,
            metadata: { eventSessionId: ticket.eventSessionId },
          },
        });
        return {
          result: 'VALID' as const,
          ticketCode: ticket.publicCode,
          ticketStatus: TicketStatus.CHECKED_IN,
          eventSessionId: ticket.eventSessionId,
          checkedInAt: checkedInAt.toISOString(),
        };
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const current = await this.prisma.ticket.findUnique({
          where: { id: ticket.id },
          include: {
            eventSession: {
              include: { event: { select: { organizationId: true, status: true } } },
            },
          },
        });
        if (current) return this.toResponseForStatus(current);
      }
      throw error;
    }
  }

  private matchesQr(
    ticket: TicketForCheckIn,
    verified: { publicCode: string; sessionBinding: string; qrNonce: string },
  ): boolean {
    return (
      ticket.qrNonce === verified.qrNonce &&
      this.qr.sessionBinding(ticket.eventSessionId) === verified.sessionBinding
    );
  }

  private toResponseForStatus(ticket: TicketForCheckIn): CheckInResponse {
    const result =
      ticket.status === TicketStatus.CHECKED_IN
        ? ('ALREADY_CHECKED_IN' as const)
        : ticket.status === TicketStatus.REFUNDED
          ? ('TICKET_REFUNDED' as const)
          : ('TICKET_VOID' as const);
    return this.toResponse(result, ticket);
  }

  private toResponse(result: CheckInResult, ticket: TicketForCheckIn): CheckInResponse {
    return {
      result,
      ticketCode: ticket.publicCode,
      ticketStatus: ticket.status,
      eventSessionId: ticket.eventSessionId,
      checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
    };
  }

  private invalidQr(): never {
    throw new BadRequestException({
      code: 'INVALID_QR_SIGNATURE',
      message: 'The QR ticket is invalid or has been tampered with',
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
