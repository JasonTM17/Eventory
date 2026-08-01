import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationMemberRole } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { ORGANIZATION_ROLES_METADATA } from './auth.constants.js';
import type { RequestWithUser } from './auth.types.js';

@Injectable()
export class OrganizationMemberGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithUser & { params: { organizationId?: string } }>();
    const user = request.user;
    const organizationId = request.params.organizationId;
    if (!user || !organizationId) throw this.accessDenied();

    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });
    if (!membership) throw this.accessDenied();

    const roles = this.reflector.getAllAndOverride<OrganizationMemberRole[] | undefined>(
      ORGANIZATION_ROLES_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (roles?.length && !roles.includes(membership.role)) throw this.accessDenied();

    return true;
  }

  private accessDenied(): ForbiddenException {
    return new ForbiddenException({
      code: 'ORGANIZATION_ACCESS_DENIED',
      message: 'You do not have access to this organization',
    });
  }
}
