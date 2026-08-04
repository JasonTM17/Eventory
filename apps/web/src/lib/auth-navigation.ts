import type { AuthUser } from '@eventory/contracts';

const roleHome: Record<AuthUser['role'], string> = {
  ADMIN: '/admin',
  ORGANIZER: '/organizer',
  ATTENDEE: '/events',
};

export function destinationAfterAuth(nextPath: string | undefined, role: AuthUser['role']): string {
  const hasUnsafeSeparator = nextPath
    ? nextPath.includes('\\') || /%(?:2f|5c)/i.test(nextPath)
    : true;
  const hasControlCharacter = nextPath
    ? Array.from(nextPath).some((character) => character.charCodeAt(0) < 32)
    : true;
  if (nextPath?.startsWith('/') && !hasUnsafeSeparator && !hasControlCharacter) {
    const destination = new URL(nextPath, 'https://eventory.local');
    if (destination.origin === 'https://eventory.local') {
      return `${destination.pathname}${destination.search}${destination.hash}`;
    }
  }
  return roleHome[role];
}
