import { db } from '../db/client';
import {
  packagingSets as packagingSetsTable,
  packagingSetItems as packagingSetItemsTable,
  packaging as packagingTable,
} from '../db/schema';
import { eq } from 'drizzle-orm';

type PackagingSetItemRow = typeof packagingSetItemsTable.$inferSelect & {
  packaging_name: string;
  unit: string;
  pack_price: number;
  pack_size: number;
  waste_pct: number;
};

export const packagingSetRepository = {
  async getAll() {
    const [sets, items, allPackaging] = await Promise.all([
      db.select().from(packagingSetsTable).orderBy(packagingSetsTable.sort_order, packagingSetsTable.name),
      db.select().from(packagingSetItemsTable).orderBy(packagingSetItemsTable.sort_order),
      db.select().from(packagingTable),
    ]);

    const packagingById = new Map(allPackaging.map((p) => [p.id, p]));

    const itemsBySet = new Map<number, PackagingSetItemRow[]>();
    for (const item of items) {
      const packaging = packagingById.get(item.packaging_id);
      const enriched: PackagingSetItemRow = {
        ...item,
        packaging_name: packaging?.name ?? '',
        unit: (packaging?.unit ?? 'pcs') as string,
        pack_price: packaging?.pack_price ?? 0,
        pack_size: packaging?.pack_size ?? 1,
        waste_pct: packaging?.waste_pct ?? 0,
      };
      if (!itemsBySet.has(item.set_id)) itemsBySet.set(item.set_id, []);
      itemsBySet.get(item.set_id)!.push(enriched);
    }

    return sets.map((s) => ({
      ...s,
      items: itemsBySet.get(s.id) || [],
    }));
  },

  async getById(id: number) {
    const sets = await this.getAll();
    return sets.find((s) => s.id === id) ?? null;
  },

  async create(data: { name: string; description?: string; sort_order?: number }) {
    const [row] = await db
      .insert(packagingSetsTable)
      .values({
        name: data.name,
        description: data.description ?? '',
        sort_order: data.sort_order ?? 0,
      })
      .returning();
    return row;
  },

  async update(id: number, data: Partial<{ name: string; description: string; sort_order: number }>) {
    return db.update(packagingSetsTable).set(data).where(eq(packagingSetsTable.id, id)).returning();
  },

  async delete(id: number) {
    return db.delete(packagingSetsTable).where(eq(packagingSetsTable.id, id));
  },
};

export const packagingSetItemRepository = {
  async create(data: {
    set_id: number;
    packaging_id: number;
    qty_needed: number;
    notes: string;
    sort_order: number;
  }) {
    const [row] = await db.insert(packagingSetItemsTable).values(data).returning();
    return row;
  },

  async update(id: number, data: Partial<{
    packaging_id: number;
    qty_needed: number;
    notes: string;
    sort_order: number;
  }>) {
    return db.update(packagingSetItemsTable).set(data).where(eq(packagingSetItemsTable.id, id)).returning();
  },

  async delete(id: number) {
    return db.delete(packagingSetItemsTable).where(eq(packagingSetItemsTable.id, id));
  },

  async deleteBySet(setId: number) {
    return db.delete(packagingSetItemsTable).where(eq(packagingSetItemsTable.set_id, setId));
  },
};
