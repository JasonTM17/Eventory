import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentReconciliationStatus, Prisma, UserStatus } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AdminEventQueryDto } from './admin.dto.js';

type PageInput = { page?: number; pageSize?: number; search?: string };
type PaymentReconciliationPageInput = PageInput & {
  status?: PaymentReconciliationStatus;
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listUsers(input: PageInput) {
    const page = this.page(input.page);
    const pageSize = this.pageSize(input.pageSize);
    const search = input.search?.trim();
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          status: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
      page,
      pageSize,
      total,
      pageCount: Math.ceil(total / pageSize),
    };
  }

  async updateUserStatus(targetUserId: string, actorUserId: string, status: UserStatus) {
    if (targetUserId === actorUserId) {
      throw new ConflictException({
        code: 'ADMIN_SELF_MODERATION_DENIED',
        message: 'An administrator cannot suspend their own account',
      });
    }
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, status: true },
    });
    if (!target) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: targetUserId },
        data: { status },
        select: { id: true, status: true },
      });
      if (status === UserStatus.SUSPENDED) {
        await tx.refreshToken.updateMany({
          where: { userId: targetUserId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return user;
    });
    await this.audit.record({
      action: `ADMIN_USER_${status}`,
      resourceType: 'User',
      resourceId: targetUserId,
      actorUserId,
      metadata: { previousStatus: target.status, status },
    });
    return updated;
  }

  async listOrganizations(input: PageInput) {
    const page = this.page(input.page);
    const pageSize = this.pageSize(input.pageSize);
    const search = input.search?.trim();
    const where: Prisma.OrganizationWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          ownerId: true,
          createdAt: true,
          _count: { select: { members: true, events: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.organization.count({ where }),
    ]);
    return {
      items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
      page,
      pageSize,
      total,
      pageCount: Math.ceil(total / pageSize),
    };
  }

  async listEvents(input: AdminEventQueryDto) {
    const page = this.page(input.page);
    const pageSize = this.pageSize(input.pageSize);
    const search = input.search?.trim();
    const where: Prisma.EventWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        select: {
          id: true,
          organizationId: true,
          name: true,
          slug: true,
          status: true,
          startAt: true,
          endAt: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.event.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        startAt: item.startAt.toISOString(),
        endAt: item.endAt.toISOString(),
        createdAt: item.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      pageCount: Math.ceil(total / pageSize),
    };
  }

  async listAuditLogs(input: PageInput) {
    const page = this.page(input.page);
    const pageSize = this.pageSize(input.pageSize);
    const action = input.search?.trim();
    const where = action ? { action: { contains: action, mode: 'insensitive' as const } } : {};
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        select: {
          id: true,
          action: true,
          resourceType: true,
          resourceId: true,
          metadata: true,
          actorUserId: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
      page,
      pageSize,
      total,
      pageCount: Math.ceil(total / pageSize),
    };
  }

  async listPaymentReconciliations(input: PaymentReconciliationPageInput) {
    const page = this.page(input.page);
    const pageSize = this.pageSize(input.pageSize);
    const search = input.search?.trim();
    const where: Prisma.PaymentReconciliationWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(search
        ? {
            OR: [
              { providerEventId: { contains: search, mode: 'insensitive' } },
              { reason: { contains: search, mode: 'insensitive' } },
              { payment: { booking: { publicCode: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.paymentReconciliation.findMany({
        where,
        select: {
          id: true,
          paymentId: true,
          providerEventId: true,
          reason: true,
          status: true,
          resolution: true,
          createdAt: true,
          resolvedAt: true,
          payment: {
            select: {
              providerReference: true,
              status: true,
              amountMinor: true,
              currency: true,
              booking: { select: { publicCode: true, status: true } },
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.paymentReconciliation.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        resolvedAt: item.resolvedAt?.toISOString() ?? null,
      })),
      page,
      pageSize,
      total,
      pageCount: Math.ceil(total / pageSize),
    };
  }

  async resolvePaymentReconciliation(
    reconciliationId: string,
    actorUserId: string,
    resolution: string,
  ) {
    const normalizedResolution = resolution.trim();
    const resolved = await this.prisma.$transaction(async (tx) => {
      const current = await tx.paymentReconciliation.findUnique({
        where: { id: reconciliationId },
      });
      if (!current) {
        throw new NotFoundException({
          code: 'PAYMENT_RECONCILIATION_NOT_FOUND',
          message: 'Payment reconciliation was not found',
        });
      }
      if (current.status === PaymentReconciliationStatus.RESOLVED) {
        throw new ConflictException({
          code: 'PAYMENT_RECONCILIATION_ALREADY_RESOLVED',
          message: 'Payment reconciliation is already resolved',
        });
      }
      const updated = await tx.paymentReconciliation.updateMany({
        where: { id: reconciliationId, status: PaymentReconciliationStatus.OPEN },
        data: {
          status: PaymentReconciliationStatus.RESOLVED,
          resolution: normalizedResolution,
          resolvedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException({
          code: 'PAYMENT_RECONCILIATION_ALREADY_RESOLVED',
          message: 'Payment reconciliation is already resolved',
        });
      }
      const resolved = await tx.paymentReconciliation.findUniqueOrThrow({
        where: { id: reconciliationId },
      });
      await tx.auditLog.create({
        data: {
          action: 'ADMIN_PAYMENT_RECONCILIATION_RESOLVED',
          resourceType: 'PaymentReconciliation',
          resourceId: reconciliationId,
          actorUserId,
          metadata: { resolution: normalizedResolution },
        },
      });
      return resolved;
    });
    return {
      id: resolved.id,
      paymentId: resolved.paymentId,
      status: resolved.status,
      resolution: resolved.resolution,
      resolvedAt: resolved.resolvedAt?.toISOString() ?? null,
    };
  }

  private page(value?: number): number {
    return Math.min(Math.max(value ?? 1, 1), 10_000);
  }

  private pageSize(value?: number): number {
    return Math.min(Math.max(value ?? 20, 1), 100);
  }
}
