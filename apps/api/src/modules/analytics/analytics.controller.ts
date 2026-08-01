import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/auth.decorators.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { AnalyticsQueryDto } from './analytics.dto.js';
import { AnalyticsService } from './analytics.service.js';

@Controller('organizer/events')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get(':eventId/analytics')
  eventMetrics(
    @Param('eventId') eventId: string,
    @Query() query: AnalyticsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.analytics.eventMetrics(eventId, user.id, query);
  }
}
