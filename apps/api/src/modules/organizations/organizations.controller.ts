import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/auth.decorators.js';
import { OrganizationMemberGuard } from '../../common/auth/organization-member.guard.js';
import { OrganizationRoles } from '../../common/auth/organization.decorator.js';
import type { AuthenticatedUser } from '../../common/auth/auth.types.js';
import { OrganizationMemberRole } from '../../generated/prisma/client.js';
import { UseGuards } from '@nestjs/common';
import { CreateOrganizationDto, AddOrganizationMemberDto } from './organization.dto.js';
import { OrganizationsService } from './organizations.service.js';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post()
  create(
    @Body() body: CreateOrganizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ id: string; name: string; slug: string }> {
    return this.organizations.create({ name: body.name, ownerId: user.id });
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<
    Array<{ id: string; name: string; slug: string; membership: OrganizationMemberRole }>
  > {
    return this.organizations.listForUser(user.id);
  }

  @Get(':organizationId')
  @UseGuards(OrganizationMemberGuard)
  get(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<unknown> {
    return this.organizations.getForMember(organizationId, user.id);
  }

  @Post(':organizationId/members')
  @UseGuards(OrganizationMemberGuard)
  @OrganizationRoles(OrganizationMemberRole.OWNER, OrganizationMemberRole.ADMIN)
  addMember(
    @Param('organizationId') organizationId: string,
    @Body() body: AddOrganizationMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ userId: string; role: OrganizationMemberRole }> {
    return this.organizations.addMember({
      organizationId,
      actorUserId: user.id,
      userId: body.userId,
      role: body.role,
    });
  }
}
