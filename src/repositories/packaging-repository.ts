import { db } from '../db/client';
import { packagingSets, packagingComponents, productPackaging } from '../db/schema';
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
  row: typeof packagingSets.$inferSelect,
  components: PackagingComponent[],
): PackagingMaterial => ({
  id: row.id,
  name: row.packaging_name,
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
      db.select().from(packagingSets).orderBy(packagingSets.sort_order, packagingSets.packaging_name),
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
      const normalizedName = data.name.trim().toLowerCase();
      const existingSet = (await tx.select().from(packagingSets))
        .find((row) => row.packaging_name.trim().toLowerCase() === normalizedName);

      // A set name identifies one packaging set. If a user starts a new set
      // with an existing name, add/update its component rows instead of
      // creating another top-level library entry.
      if (existingSet) {
        await tx.update(packagingSets).set({
          packaging_name: data.name,
          description: data.description,
        }).where(eq(packagingSets.id, existingSet.id));
        const existingComponents = await tx.select().from(packagingComponents)
          .where(eq(packagingComponents.packaging_id, existingSet.id));
        let nextSortOrder = existingComponents.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;
        for (const component of data.components) {
          const match = existingComponents.find((row) =>
            row.name.trim().toLowerCase() === component.name.trim().toLowerCase(),
          );
          if (match) {
            await tx.update(packagingComponents)
              .set({ ...component, sort_order: match.sort_order })
              .where(eq(packagingComponents.id, match.id));
          } else {
            await tx.insert(packagingComponents).values(componentValues(existingSet.id, component, nextSortOrder++));
          }
        }
        return existingSet.id;
      }

      const [row] = await tx.insert(packagingSets).values({
        packaging_name: data.name,
        description: data.description,
        sort_order: (await tx.select().from(packagingSets)).length,
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
      const [row] = await tx.update(packagingSets).set({
        packaging_name: data.name,
        description: data.description,
      }).where(eq(packagingSets.id, id)).returning();
      if (!row) return null;
      await tx.delete(packagingComponents).where(eq(packagingComponents.packaging_id, id));
      for (const [index, component] of data.components.entries()) {
        await tx.insert(packagingComponents).values(componentValues(id, component, index));
      }
      return row.id;
    });
    return updatedId === null ? [] : this.getById(updatedId);
  },

  async delete(id: number) {
    await db.transaction(async (tx) => {
      // Remove recipe links first so deleting a set also removes it from the
      // recipes that used it instead of failing on the restrictive FK.
      await tx.delete(productPackaging).where(eq(productPackaging.packaging_id, id));
      await tx.delete(packagingSets).where(eq(packagingSets.id, id));
    });
  },

  async mergeInto(targetId: number, sourceIds: number[]): Promise<void> {
    const ids = [...new Set(sourceIds)].filter((id) => id !== targetId);
    if (ids.length === 0) return;

    await db.transaction(async (tx) => {
      const target = (await tx.select().from(packagingSets).where(eq(packagingSets.id, targetId)))[0];
      if (!target) throw new Error('The packaging set to merge into no longer exists.');

      const targetComponents = await tx.select().from(packagingComponents)
        .where(eq(packagingComponents.packaging_id, targetId));
      let nextSortOrder = targetComponents.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;

      for (const sourceId of ids) {
        const source = (await tx.select().from(packagingSets).where(eq(packagingSets.id, sourceId)))[0];
        if (!source) continue;

        const components = await tx.select().from(packagingComponents)
          .where(eq(packagingComponents.packaging_id, sourceId));
        for (const component of components) {
          await tx.update(packagingComponents).set({
            packaging_id: targetId,
            sort_order: nextSortOrder++,
          }).where(eq(packagingComponents.id, component.id));
        }

        const sourceLines = await tx.select().from(productPackaging)
          .where(eq(productPackaging.packaging_id, sourceId));
        for (const sourceLine of sourceLines) {
          const targetLines = await tx.select().from(productPackaging)
            .where(eq(productPackaging.product_id, sourceLine.product_id));
          const existing = targetLines.find((line) => line.packaging_id === targetId);
          if (existing) {
            await tx.update(productPackaging)
              .set({ qty: existing.qty + sourceLine.qty })
              .where(eq(productPackaging.id, existing.id));
            await tx.delete(productPackaging).where(eq(productPackaging.id, sourceLine.id));
          } else {
            await tx.update(productPackaging)
              .set({ packaging_id: targetId })
              .where(eq(productPackaging.id, sourceLine.id));
          }
        }

        await tx.delete(packagingSets).where(eq(packagingSets.id, sourceId));
      }
    });
  },
};
