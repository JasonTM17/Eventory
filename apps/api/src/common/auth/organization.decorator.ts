import { SetMetadata } from '@nestjs/common';
import type { OrganizationMemberRole } from '../../generated/prisma/client.js';
import { ORGANIZATION_ROLES_METADATA } from './auth.constants.js';

export const OrganizationRoles = (
  ...roles: OrganizationMemberRole[]
): ReturnType<typeof SetMetadata> => SetMetadata(ORGANIZATION_ROLES_METADATA, roles);
