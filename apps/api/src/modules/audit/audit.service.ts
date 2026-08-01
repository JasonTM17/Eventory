import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/database/prisma.service.js';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    action: string;
    resourceType: string;
    resourceId?: string;
    actorUserId?: string;
    ipAddress?: string;
    metadata?: Prisma.InputJsonObject;
  }): Promise<void> {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      action: input.action,
      resourceType: input.resourceType,
      metadata: input.metadata ?? {},
    };
    if (input.resourceId) data.resourceId = input.resourceId;
    if (input.actorUserId) data.actorUserId = input.actorUserId;
    if (input.ipAddress) data.ipAddress = input.ipAddress;
    await this.prisma.auditLog.create({ data });
  }
}
