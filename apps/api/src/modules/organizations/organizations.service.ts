import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationMemberRole, Prisma, UserRole } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(input: { name: string; ownerId: string }): Promise<{
    id: string;
    name: string;
    slug: string;
  }> {
    const name = input.name.trim();
    const slug = this.slugify(name);
    try {
      const organization = await this.prisma.$transaction(async (tx) => {
        const created = await tx.organization.create({
          data: { name, slug, ownerId: input.ownerId },
        });
        await tx.organizationMember.create({
          data: {
            organizationId: created.id,
            userId: input.ownerId,
            role: OrganizationMemberRole.OWNER,
          },
        });
        await tx.user.update({
          where: { id: input.ownerId },
          data: { role: UserRole.ORGANIZER },
        });
        return created;
      });
      await this.audit.record({
        action: 'ORGANIZATION_CREATED',
        resourceType: 'Organization',
        resourceId: organization.id,
        actorUserId: input.ownerId,
      });
      return { id: organization.id, name: organization.name, slug: organization.slug };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'ORGANIZATION_SLUG_CONFLICT',
          message: 'An organization with that name already exists',
        });
      }
      throw error;
    }
  }

  async assertAccess(
    organizationId: string,
    userId: string,
    roles?: OrganizationMemberRole[],
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role === UserRole.ADMIN) return;
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true },
    });
    if (!membership || (roles?.length && !roles.includes(membership.role))) {
      throw this.accessDenied();
    }
  }

  async getForMember(organizationId: string, userId: string): Promise<unknown> {
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, members: { some: { userId } } },
      include: { members: { where: { userId }, select: { role: true } } },
    });
    if (!organization) throw this.accessDenied();
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      membership: organization.members[0]?.role,
    };
  }

  async listForUser(
    userId: string,
  ): Promise<
    Array<{ id: string; name: string; slug: string; membership: OrganizationMemberRole }>
  > {
    const organizations = await this.prisma.organization.findMany({
      where: { members: { some: { userId } } },
      orderBy: { name: 'asc' },
      include: { members: { where: { userId }, select: { role: true } } },
    });
    return organizations.flatMap((organization) => {
      const membership = organization.members[0]?.role;
      return membership
        ? [{ id: organization.id, name: organization.name, slug: organization.slug, membership }]
        : [];
    });
  }

  async addMember(input: {
    organizationId: string;
    actorUserId: string;
    userId: string;
    role: OrganizationMemberRole;
  }): Promise<{ userId: string; role: OrganizationMemberRole }> {
    const target = await this.prisma.user.findUnique({ where: { id: input.userId } });
    if (!target) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    try {
      const member = await this.prisma.organizationMember.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId,
          role: input.role,
        },
      });
      await this.audit.record({
        action: 'ORGANIZATION_MEMBER_ADDED',
        resourceType: 'Organization',
        resourceId: input.organizationId,
        actorUserId: input.actorUserId,
        metadata: { targetUserId: input.userId, role: input.role },
      });
      return { userId: member.userId, role: member.role };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'ORGANIZATION_MEMBER_EXISTS',
          message: 'That user is already a member of this organization',
        });
      }
      throw error;
    }
  }

  private slugify(name: string): string {
    const slug = name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 180);
    if (!slug)
      throw new ConflictException({
        code: 'INVALID_ORGANIZATION_NAME',
        message: 'Organization name is invalid',
      });
    return slug;
  }

  private accessDenied(): ForbiddenException {
    return new ForbiddenException({
      code: 'ORGANIZATION_ACCESS_DENIED',
      message: 'You do not have access to this organization',
    });
  }
}
