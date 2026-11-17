import { db } from '../db/client';
import { packaging, packagingComponents } from '../db/schema';
import type { PackagingComponent, PackagingMaterial, Unit } from '../types';
import { eq } from 'drizzle-orm';

export interface PackagingComponentInput {
  name: string;
  description: string;
  unit: Unit;
  pack_price: number;
  pack_size: number;
  qty_needed: number;
  waste_pct: number;
}

export interface PackagingSetInput {
  name: string;
  description: string;
  components: PackagingComponentInput[];
}

const asPackagingMaterial = (
  row: typeof packaging.$inferSelect,
  components: PackagingComponent[],
): PackagingMaterial => ({
  id: row.id,
  name: row.name,
  description: row.description,
  sort_order: row.sort_order,
  components,
});

const componentValues = (packagingId: number, component: PackagingComponentInput, sortOrder: number) => ({
  packaging_id: packagingId,
  ...component,
  sort_order: sortOrder,
});

export const packagingRepository = {
  async getAll(): Promise<PackagingMaterial[]> {
    const [sets, components] = await Promise.all([
      db.select().from(packaging).orderBy(packaging.sort_order, packaging.name),
      db.select().from(packagingComponents).orderBy(packagingComponents.sort_order, packagingComponents.id),
    ]);
    const componentsBySet = new Map<number, PackagingComponent[]>();
    for (const component of components) {
      const items = componentsBySet.get(component.packaging_id) ?? [];
      items.push({ ...component, unit: component.unit as Unit });
      componentsBySet.set(component.packaging_id, items);
    }
    return sets.map((row) => asPackagingMaterial(row, componentsBySet.get(row.id) ?? []));
  },

  async getById(id: number): Promise<PackagingMaterial[]> {
    return (await this.getAll()).filter((row) => row.id === id);
  },

  async create(data: PackagingSetInput): Promise<PackagingMaterial[]> {
    if (data.components.length === 0) throw new Error('A packaging set needs at least one component.');
    const id = await db.transaction(async (tx) => {
      const [row] = await tx.insert(packaging).values({
        name: data.name,
        description: data.description,
        unit: 'pcs',
        pack_price: 0,
        pack_size: 1,
        qty_needed: 1,
        waste_pct: 0,
      }).returning();
      for (const [index, component] of data.components.entries()) {
        await tx.insert(packagingComponents).values(componentValues(row.id, component, index));
      }
      return row.id;
    });
    return this.getById(id);
  },

  async update(id: number, data: PackagingSetInput): Promise<PackagingMaterial[]> {
    if (data.components.length === 0) throw new Error('A packaging set needs at least one component.');
    const updatedId = await db.transaction(async (tx) => {
      const [row] = await tx.update(packaging).set({
        name: data.name,
        description: data.description,
      }).where(eq(packaging.id, id)).returning();
      if (!row) return null;
      await tx.delete(packagingComponents).where(eq(packagingComponents.packaging_id, id));
      for (const [index, component] of data.components.entries()) {
        await tx.insert(packagingComponents).values(componentValues(id, component, index));
      }
      return row.id;
    });
    return updatedId === null ? [] : this.getById(updatedId);
  },

  delete(id: number) {
    return db.delete(packaging).where(eq(packaging.id, id));
  },
};
