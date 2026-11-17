import type { SQLocalDrizzle } from 'sqlocal/drizzle';
import { migrations } from './migrations';

function splitStatements(sql: string): string[] {
  return sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Applies any migrations not yet recorded in `_migrations`, in order, each
 * inside its own transaction so a failure partway through rolls back instead
 * of leaving the schema half-applied.
 */
export async function runMigrations(client: SQLocalDrizzle): Promise<void> {
  await client.sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )
  `;

  // Foreign keys must be on for cascade deletes and restrict behaviour.
  await client.sql`PRAGMA foreign_keys = ON`;

  const applied = await client.sql<{ id: string }>`SELECT id FROM _migrations`;
  const appliedIds = new Set(applied.map((row) => row.id));

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) continue;

    const statements = splitStatements(migration.sql);

    await client.transaction(async (tx) => {
      for (const statement of statements) {
        try {
          await tx.sql(statement);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '';
          // SQLite doesn't support IF NOT EXISTS for every statement, so
          // tolerate errors from partially-applied previous runs.
          if (
            msg.includes('duplicate column name') ||
            msg.includes('already exists') ||
            msg.includes('already exists')
          ) {
            continue;
          }
          throw err;
        }
      }
      await tx.sql`INSERT INTO _migrations (id, applied_at) VALUES (${migration.id}, ${Date.now()})`;
    });
  }
}