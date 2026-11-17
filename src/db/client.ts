import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { SQLocalDrizzle } from 'sqlocal/drizzle';
import * as schema from './schema';
import { runMigrations } from './migrate';

/**
 * One SQLite database per origin (one browser, one profile — no users, no
 * auth). sqlocal runs the engine in a Web Worker and persists to the
 * Origin Private File System (OPFS).
 *
 * `db` is the Drizzle instance used by repositories.
 * `sqlocalClient` is the raw client, exposed for file-level ops (reset).
 * `dbError` is set if the client could not be created (e.g. Worker blocked).
 * `migrationsReady` resolves once the schema exists — await it before
 * rendering the app (see main.tsx).
 */

let client: SQLocalDrizzle | null = null;
let dbError: string | null = null;
let initDone = false;

async function initialize(): Promise<void> {
  try {
    const c = new SQLocalDrizzle('brew-variance.sqlite3');
    client = c;
    await runMigrations(c);
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
    console.error('Database client creation failed:', err);
  }
  initDone = true;
}

initialize();

const { driver, batchDriver } = new Proxy({} as { driver: any; batchDriver: any }, {
  get(_, prop) {
    if (!initDone || !client) {
      throw new Error(dbError ?? 'Database not yet initialized');
    }
    return (client as any)[prop];
  },
});

export const db = drizzle(driver, batchDriver, { schema });

export const sqlocalClient = new Proxy({} as SQLocalDrizzle, {
  get(_, prop) {
    if (!initDone || !client) {
      throw new Error(dbError ?? 'Database not yet initialized');
    }
    return (client as any)[prop];
  },
});

export { dbError };

export const migrationsReady = new Promise<void>((resolve) => {
  const check = () => {
    if (initDone) {
      resolve();
    } else {
      setTimeout(check, 10);
    }
  };
  check();
});
