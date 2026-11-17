import { db } from '../db/client';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';

const DEFAULT_CURRENCY = '₱';

export const settingsRepository = {
  async getAll() {
    return db.select().from(settings);
  },

  async get(key: string) {
    return db.select().from(settings).where(eq(settings.key, key));
  },

  async set(key: string, value: string) {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  },

  async delete(key: string) {
    await db.delete(settings).where(eq(settings.key, key));
  },

  async getCurrency(): Promise<string> {
    const rows = await this.get('currency');
    if (rows.length === 0) {
      await this.set('currency', DEFAULT_CURRENCY);
      return DEFAULT_CURRENCY;
    }
    return rows[0].value;
  },
};