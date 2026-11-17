import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { SQLocalDrizzle } from 'sqlocal/drizzle';
import * as schema from './schema';
import { runMigrationsWithTimeout } from './migrate';

/**
 * One SQLite database per origin (one browser, one profile — no users, no
 * auth). sqlocal runs the engine in a Web Worker and persists to the
 * Origin Private File System (OPFS).
 *
 * `db` is the Drizzle instance used by repositories.
 * `sqlocalClient` is the raw client, exposed for file-level ops (reset).
 * `migrationsReady` resolves once the schema exists — await it before
 * rendering the app (see main.tsx).
 */

const client = new SQLocalDrizzle('brew-variance.sqlite3');
const { driver, batchDriver } = client;

export const db = drizzle(driver, batchDriver, { schema });

export const sqlocalClient = client;

export const migrationsReady = runMigrationsWithTimeout(client);
