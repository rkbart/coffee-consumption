import { db } from '../db/client';
import { packaging } from '../db/schema';
import { eq } from 'drizzle-orm';

export const packagingRepository = {
  getAll() {
    return db.select().from(packaging).orderBy(packaging.sort_order, packaging.name);
  },

  getById(id: number) {
    return db.select().from(packaging).where(eq(packaging.id, id));
  },

  create(data: Omit<typeof packaging.$inferInsert, 'id'>) {
    return db.insert(packaging).values(data).returning();
  },

  update(id: number, data: Partial<Omit<typeof packaging.$inferInsert, 'id'>>) {
    return db.update(packaging).set(data).where(eq(packaging.id, id)).returning();
  },

  delete(id: number) {
    return db.delete(packaging).where(eq(packaging.id, id));
  },
};