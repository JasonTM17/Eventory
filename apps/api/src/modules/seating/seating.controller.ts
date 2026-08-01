import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { CurrentUser, Public, RateLimit } from '../../common/auth/auth.decorators.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { HoldSeatsDto, ReleaseSeatsDto, RenewSeatsDto } from './seating.dto.js';
import { SeatingService } from './seating.service.js';

@Controller('seating')
export class SeatingController {
  constructor(private readonly seating: SeatingService) {}

  @Public()
  @Get(':eventSessionId/availability')
  availability(@Param('eventSessionId') eventSessionId: string): Promise<unknown> {
    return this.seating.availability(eventSessionId);
  }

  @Post(':eventSessionId/holds')
  @RateLimit(60)
  @HttpCode(HttpStatus.OK)
  hold(
    @Param('eventSessionId') eventSessionId: string,
    @Body() body: HoldSeatsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.seating.hold(eventSessionId, user.id, body.seatIds, body.idempotencyKey);
  }

  @Delete(':eventSessionId/holds')
  @RateLimit(60)
  @HttpCode(HttpStatus.OK)
  release(
    @Param('eventSessionId') eventSessionId: string,
    @Body() body: ReleaseSeatsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.seating.release(eventSessionId, user.id, body.seatIds, body.holdToken);
  }

  @Post(':eventSessionId/holds/renew')
  @RateLimit(120)
  @HttpCode(HttpStatus.OK)
  renew(
    @Param('eventSessionId') eventSessionId: string,
    @Body() body: RenewSeatsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.seating.renew(eventSessionId, user.id, body.seatIds, body.holdToken);
  }
}
