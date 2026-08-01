import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';

@Injectable()
export class VenuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
  ) {}

  async createVenue(input: {
    organizationId: string;
    userId: string;
    name: string;
    address?: string;
  }): Promise<unknown> {
    await this.organizations.assertAccess(input.organizationId, input.userId);
    return this.prisma.venue.create({
      data: {
        organizationId: input.organizationId,
        name: input.name.trim(),
        ...(input.address ? { address: input.address.trim() } : {}),
      },
      select: { id: true, organizationId: true, name: true, address: true },
    });
  }

  async createSection(input: {
    venueId: string;
    userId: string;
    name: string;
    sortOrder?: number;
  }): Promise<unknown> {
    const venue = await this.findVenueForUser(input.venueId, input.userId);
    try {
      return await this.prisma.venueSection.create({
        data: {
          venueId: venue.id,
          name: input.name.trim(),
          ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
        },
        select: { id: true, venueId: true, name: true, sortOrder: true },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'VENUE_SECTION_EXISTS',
          message: 'Venue section already exists',
        });
      }
      throw error;
    }
  }

  async createSeat(input: {
    sectionId: string;
    userId: string;
    rowLabel: string;
    seatNumber: number;
    code?: string;
  }): Promise<unknown> {
    const section = await this.prisma.venueSection.findUnique({
      where: { id: input.sectionId },
      include: { venue: true },
    });
    if (!section)
      throw new NotFoundException({
        code: 'VENUE_SECTION_NOT_FOUND',
        message: 'Venue section not found',
      });
    await this.organizations.assertAccess(section.venue.organizationId, input.userId);
    const code = input.code?.trim() || `${section.name}-${input.rowLabel}-${input.seatNumber}`;
    try {
      return await this.prisma.seat.create({
        data: {
          venueId: section.venueId,
          sectionId: section.id,
          rowLabel: input.rowLabel.trim(),
          seatNumber: input.seatNumber,
          code,
        },
        select: {
          id: true,
          venueId: true,
          sectionId: true,
          rowLabel: true,
          seatNumber: true,
          code: true,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'VENUE_SEAT_EXISTS',
          message: 'Venue seat already exists',
        });
      }
      throw error;
    }
  }

  private async findVenueForUser(venueId: string, userId: string) {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue)
      throw new NotFoundException({ code: 'VENUE_NOT_FOUND', message: 'Venue not found' });
    await this.organizations.assertAccess(venue.organizationId, userId);
    return venue;
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
