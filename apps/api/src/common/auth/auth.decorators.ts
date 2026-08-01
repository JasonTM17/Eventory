import { createParamDecorator, SetMetadata } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { PUBLIC_ROUTE_METADATA, ROLES_METADATA } from './auth.constants.js';
import type { AuthenticatedUser } from './auth.types.js';

export const Public = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(PUBLIC_ROUTE_METADATA, true);

export const Roles = (...roles: AuthenticatedUser['role'][]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_METADATA, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
