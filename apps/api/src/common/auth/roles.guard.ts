import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_METADATA } from './auth.constants.js';
import type { RequestWithUser } from './auth.types.js';
import type { UserRole } from '../../generated/prisma/client.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (request.user && roles.includes(request.user.role)) return true;

    throw new ForbiddenException({
      code: 'INSUFFICIENT_ROLE',
      message: 'You do not have permission to perform this action',
    });
  }
}
