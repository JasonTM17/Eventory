import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, RateLimit } from '../../common/auth/auth.decorators.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { CreateBookingDto } from './booking.dto.js';
import { BookingsService } from './bookings.service.js';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  @RateLimit(20)
  create(@Body() body: CreateBookingDto, @CurrentUser() user: AuthenticatedUser): Promise<unknown> {
    return this.bookings.create(user.id, body);
  }

  @Get(':bookingId')
  get(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.bookings.get(user.id, bookingId);
  }
}
