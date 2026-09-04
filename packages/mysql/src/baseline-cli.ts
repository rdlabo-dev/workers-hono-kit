import { createConnection } from 'mysql2/promise';
import { baselineMigrations } from './migrate.js';
import { resolveDbSecret } from './orm-config.js';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/** Run the brownfield migration-baseline command. */
export async function runBaselineCli(): Promise<void> {
  const migrationsFolder = arg('migrations') ?? process.env.MIGRATIONS_DIR ?? './drizzle';
  const secret = resolveDbSecret();
  const connectionOptions = secret
    ? {
        host: secret.host,
        port: secret.port,
        user: secret.username,
        password: secret.password,
        database: secret.dbname,
      }
    : {
        host: process.env.DB_HOST ?? '127.0.0.1',
        port: Number(process.env.DB_PORT ?? '3306'),
        user: process.env.DB_USER ?? 'root',
        password: process.env.DB_PASSWORD ?? 'root',
        database: process.env.DB_NAME,
      };

  if (!connectionOptions.database) {
    console.error('[db:baseline] DB_NAME (or DB_SECRET) is required.');
    process.exitCode = 1;
    return;
  }

  console.log('[db:baseline] database target configured.');
  const db = await createConnection(connectionOptions);
  await baselineMigrations({ db, migrationsFolder })
    .then(
      (result) => {
        if (result.status === 'already-baselined') {
          console.log(`[db:baseline] already baselined (${result.tag}, created_at=${result.when}). no-op.`);
          return;
        }
        console.log(
          `[db:baseline] inserted baseline marker for ${result.tag} (created_at=${result.when}). ` +
            '0000 is now recorded as applied; future migrations will run.',
        );
      },
      (error: unknown) => {
        console.error('[db:baseline] failed:', error instanceof Error ? error.message : error);
        process.exitCode = 1;
      },
    )
    .finally(() => db.end());
}
