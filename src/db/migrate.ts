import type { SQLocalDrizzle } from 'sqlocal/drizzle';
import { migrations } from './migrations';

function splitStatements(sql: string): string[] {
  return sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`DB step timed out: ${label}`)), 3000)
  );
  return Promise.race([promise, timeout]);
}

/**
 * Applies migrations with per-step timeouts so a hung OPFS worker fails fast
 * instead of leaving the app on a blank page forever.
 */
export async function runMigrationsWithTimeout(client: SQLocalDrizzle): Promise<void> {
  await withTimeout(
    client.sql`CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)`,
    'create _migrations table'
  );

  await withTimeout(client.sql`PRAGMA foreign_keys = ON`, 'PRAGMA foreign_keys');

  const applied = await withTimeout(
    client.sql<{ id: string }>`SELECT id FROM _migrations`,
    'SELECT id FROM _migrations'
  );
  const appliedIds = new Set(applied.map((row) => row.id));

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) continue;

    const statements = splitStatements(migration.sql);

    await withTimeout(
      client.transaction(async (tx) => {
        for (const statement of statements) {
          try {
            await withTimeout(tx.sql(statement), `migration ${migration.id} statement`);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '';
            if (
              msg.includes('duplicate column name') ||
              msg.includes('already exists')
            ) {
              continue;
            }
            throw err;
          }
        }
        await withTimeout(
          tx.sql`INSERT INTO _migrations (id, applied_at) VALUES (${migration.id}, ${Date.now()})`,
          `migration ${migration.id} record`
        );
      }),
      `migration ${migration.id} transaction`
    );
  }
}
