import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const localDatabaseUrl = 'postgresql://eventory:eventory@localhost:5432/eventory?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? localDatabaseUrl,
  },
});
