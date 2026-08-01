import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/auth.decorators.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { TicketsService } from './tickets.service.js';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<unknown> {
    return this.tickets.listForUser(user.id);
  }

  @Get(':publicCode')
  get(
    @Param('publicCode') publicCode: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.tickets.getForUser(user.id, publicCode);
  }
}
