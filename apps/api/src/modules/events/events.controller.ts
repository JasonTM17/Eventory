import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Public } from '../../common/auth/auth.decorators.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { EventStatus } from '../../generated/prisma/client.js';
import {
  CreateEventDto,
  CreateSessionDto,
  CreateTicketTypeDto,
  EventListQueryDto,
  UpdateEventDto,
} from './event.dto.js';
import { EventsService } from './events.service.js';

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Public()
  @Get()
  list(@Query() query: EventListQueryDto): Promise<unknown> {
    return this.events.listPublic(query.page ?? 1, query.pageSize ?? 20, query.search);
  }

  @Public()
  @Get(':eventIdOrSlug')
  get(@Param('eventIdOrSlug') eventIdOrSlug: string): Promise<unknown> {
    return this.events.getPublic(eventIdOrSlug);
  }
}

@Controller('organizer/events')
export class OrganizerEventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  create(@Body() body: CreateEventDto, @CurrentUser() user: AuthenticatedUser): Promise<unknown> {
    return this.events.create({ ...body, userId: user.id });
  }

  @Patch(':eventId')
  update(
    @Param('eventId') eventId: string,
    @Body() body: UpdateEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.events.update(eventId, { ...body, userId: user.id });
  }

  @Post(':eventId/sessions')
  addSession(
    @Param('eventId') eventId: string,
    @Body() body: CreateSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.events.addSession(eventId, { ...body, userId: user.id });
  }

  @Post(':eventId/ticket-types')
  addTicketType(
    @Param('eventId') eventId: string,
    @Body() body: CreateTicketTypeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.events.addTicketType(eventId, { ...body, userId: user.id });
  }

  @Post(':eventId/publish')
  publish(
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.events.transition(eventId, user.id, EventStatus.PUBLISHED);
  }

  @Post(':eventId/open-sales')
  openSales(
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.events.transition(eventId, user.id, EventStatus.SALES_OPEN);
  }

  @Post(':eventId/close-sales')
  closeSales(
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.events.transition(eventId, user.id, EventStatus.SALES_CLOSED);
  }

  @Post(':eventId/cancel')
  cancel(
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.events.transition(eventId, user.id, EventStatus.CANCELLED);
  }
}
