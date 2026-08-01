import { SetMetadata } from '@nestjs/common';

export const SESSION_ISSUANCE_METADATA = 'eventory:session-issuance';

export const SessionIssuance = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(SESSION_ISSUANCE_METADATA, true);
