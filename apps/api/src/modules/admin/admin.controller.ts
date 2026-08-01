import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { CurrentUser, RateLimit, Roles } from '../../common/auth/auth.decorators.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { UserRole } from '../../generated/prisma/client.js';
import { AdminEventQueryDto, AdminPageQueryDto, UpdateUserStatusDto } from './admin.dto.js';
import { AdminService } from './admin.service.js';

@Controller('admin')
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  users(@Query() query: AdminPageQueryDto): Promise<unknown> {
    return this.admin.listUsers(query);
  }

  @Patch('users/:userId/status')
  @RateLimit(60)
  updateUserStatus(
    @Param('userId') userId: string,
    @Body() body: UpdateUserStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<unknown> {
    return this.admin.updateUserStatus(userId, actor.id, body.status);
  }

  @Get('organizations')
  organizations(@Query() query: AdminPageQueryDto): Promise<unknown> {
    return this.admin.listOrganizations(query);
  }

  @Get('events')
  events(@Query() query: AdminEventQueryDto): Promise<unknown> {
    return this.admin.listEvents(query);
  }

  @Get('audit-logs')
  auditLogs(@Query() query: AdminPageQueryDto): Promise<unknown> {
    return this.admin.listAuditLogs(query);
  }
}
