import type { UserRole } from '../../generated/prisma/client.js';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  email: string;
  displayName: string;
}

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  tokenType: 'access';
}

export interface RequestWithUser {
  user?: AuthenticatedUser;
}
