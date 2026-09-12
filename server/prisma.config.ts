import { resolve } from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { databaseConfiguration } from './src/config/database';

// All backend configuration lives here; deployment/CI variables take precedence.
config({ path: resolve(__dirname, '.env'), quiet: true });
const database = databaseConfiguration(process.env);
const isDevelopmentMigration = process.argv.some((argument, index, args) => argument === 'migrate' && args[index + 1] === 'dev');
if (isDevelopmentMigration && new URL(database.url).hostname.endsWith('.neon.tech') && !database.shadowDatabaseUrl) {
  throw new Error('Neon development migrations require a separate SHADOW_DATABASE_URL. Use db:deploy to apply the checked-in migrations.');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  engine: 'classic',
  // CLI work uses a direct connection. PrismaService uses the pooled runtime
  // URL explicitly. Schema changes remain in checked-in migrations.
  datasource: {
    url: database.migrationUrl,
    ...(database.shadowDatabaseUrl ? { shadowDatabaseUrl: database.shadowDatabaseUrl } : {}),
  },
});
