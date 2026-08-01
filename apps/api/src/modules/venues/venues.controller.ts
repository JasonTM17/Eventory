import { Body, Controller, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/auth.decorators.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { CreateSeatDto, CreateVenueDto, CreateVenueSectionDto } from './venue.dto.js';
import { VenuesService } from './venues.service.js';

@Controller('organizer/venues')
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Post()
  createVenue(
    @Body() body: CreateVenueDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.venues.createVenue({ ...body, userId: user.id });
  }

  @Post(':venueId/sections')
  createSection(
    @Param('venueId') venueId: string,
    @Body() body: CreateVenueSectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.venues.createSection({ ...body, venueId, userId: user.id });
  }

  @Post('/sections/:sectionId/seats')
  createSeat(
    @Param('sectionId') sectionId: string,
    @Body() body: CreateSeatDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.venues.createSeat({ ...body, sectionId, userId: user.id });
  }
}
