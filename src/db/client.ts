import { drizzle } from 'drizzle-orm/sqlite-proxy';
import type { Sqlite3Method, RawResultData } from 'sqlocal';
import { SQLocalDrizzle } from 'sqlocal/drizzle';
import * as schema from './schema';
import { runMigrationsWithTimeout } from './migrate';

/**
 * One SQLite database per origin (one browser, one profile — no users, no
 * auth). Prefers OPFS via a Web Worker; falls back to session storage
 * (IndexedDB-backed, no worker) when OPFS worker initialization hangs.
 *
 * `db` is the Drizzle instance used by repositories.
 * `sqlocalClient` is the raw client, exposed for file-level ops (reset).
 * `dbMode` is 'opfs' | 'session' | null depending on which storage is active.
 * `dbError` is set if both storage modes failed.
 * `migrationsReady` resolves once the schema exists — await it before
 * rendering the app (see main.tsx).
 */

let client: SQLocalDrizzle | null = null;
let dbMode: 'opfs' | 'session' | null = 'opfs';
let dbError: string | null = null;
let initDone = false;
let readyResolve: (() => void) | null = null;
const readyPromise = new Promise<void>((resolve) => {
  readyResolve = resolve;
});

async function initialize(): Promise<void> {
  // Try OPFS first (cross-origin isolation confirmed true on Vercel).
  try {
    const c = new SQLocalDrizzle('brew-variance.sqlite3');
    await runMigrationsWithTimeout(c);
    client = c;
    dbMode = 'opfs';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('OPFS initialization failed:', msg);
    await client?.destroy();

    // Fall back to session storage (IndexedDB-backed, no worker needed).
    try {
      const c = new SQLocalDrizzle(':sessionStorage:');
      await runMigrationsWithTimeout(c);
      client = c;
      dbMode = 'session';
    } catch (err2) {
      dbError = err2 instanceof Error ? err2.message : String(err2);
      console.error('Session storage fallback also failed:', dbError);
    }
  }
  initDone = true;
  readyResolve?.();
}

initialize();

type DriverFn = (
  sql: string,
  params: unknown[],
  method: Sqlite3Method
) => Promise<RawResultData>;

const driver: DriverFn = async (sql, params, method) => {
  await readyPromise;
  if (!client) throw new Error(dbError ?? 'Database not initialized');
  return client.driver(sql, params, method);
};

const batchDriver = async (
  queries: { sql: string; params: unknown[]; method: Sqlite3Method }[]
): Promise<RawResultData[]> => {
  await readyPromise;
  if (!client) throw new Error(dbError ?? 'Database not initialized');
  return client.batchDriver(queries);
};

export const db = drizzle(driver, batchDriver, { schema });

export const sqlocalClient = new Proxy({} as SQLocalDrizzle, {
  get(_, prop) {
    if (!initDone || !client) {
      throw new Error(dbError ?? 'Database not yet initialized');
    }
    return (client as any)[prop];
  },
});

export { dbMode, dbError };

export const migrationsReady = readyPromise;
