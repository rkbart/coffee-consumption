import { db } from '../db/client';
import { ingredients } from '../db/schema';
import { eq } from 'drizzle-orm';

export const ingredientRepository = {
  getAll() {
    return db.select().from(ingredients).orderBy(ingredients.sort_order, ingredients.name);
  },

  getById(id: number) {
    return db.select().from(ingredients).where(eq(ingredients.id, id));
  },

  create(data: Parameters<typeof db.insert>[0] extends never
    ? never
    : Omit<typeof ingredients.$inferInsert, 'id'>) {
    return db.insert(ingredients).values(data).returning();
  },

  update(id: number, data: Partial<Omit<typeof ingredients.$inferInsert, 'id'>>) {
    return db.update(ingredients).set(data).where(eq(ingredients.id, id)).returning();
  },

  delete(id: number) {
    return db.delete(ingredients).where(eq(ingredients.id, id));
  },
};