import { db } from '../db/client';
import {
  products as productsTable,
  recipeItems as recipeItemsTable,
  productPackaging as productPackagingTable,
  ingredients as ingredientsTable,
  packagingSets as packagingSetsTable,
  packagingSetItems as packagingSetItemsTable,
} from '../db/schema';
import { eq } from 'drizzle-orm';
import type { Unit } from '../types';

export interface ProductInput {
  name: string;
  category: string;
  size_label: string;
  yield_qty: number;
  packaging_cost?: number;
  provision_pct: number;
  target_food_cost_pct: number;
  vat_pct: number;
  selling_price: number | null;
  recipe: { ingredient_id: number; qty: number }[];
  packaging: { packaging_set_id: number; qty: number }[];
}

type RecipeItemRow = typeof recipeItemsTable.$inferSelect & {
  ingredient_name: string;
  unit: Unit;
};

type ProductPackagingRow = typeof productPackagingTable.$inferSelect & {
  packaging_set_name: string;
};

export const productRepository = {
  async getAll() {
    const [products, items, packagingLines, allIngredients, allSets] =
      await Promise.all([
        db
          .select()
          .from(productsTable)
          .orderBy(productsTable.category, productsTable.name, productsTable.size_label),
        db.select().from(recipeItemsTable).orderBy(recipeItemsTable.id),
        db.select().from(productPackagingTable).orderBy(productPackagingTable.id),
        db.select().from(ingredientsTable),
        db.select().from(packagingSetsTable),
      ]);

    const setItems = await db.select().from(packagingSetItemsTable).orderBy(packagingSetItemsTable.sort_order);

    const ingredientById = new Map(allIngredients.map((i) => [i.id, i]));
    const setById = new Map(allSets.map((s) => [s.id, s]));
    const itemsBySet = new Map<number, typeof setItems[number][]>();
    for (const item of setItems) {
      if (!itemsBySet.has(item.set_id)) itemsBySet.set(item.set_id, []);
      itemsBySet.get(item.set_id)!.push(item);
    }

    const byProduct = new Map<number, RecipeItemRow[]>();
    for (const item of items) {
      const ingredient = ingredientById.get(item.ingredient_id);
      const enriched: RecipeItemRow = {
        ...item,
        ingredient_name: ingredient?.name ?? '',
        unit: (ingredient?.unit ?? 'g') as Unit,
      };
      if (!byProduct.has(item.product_id)) byProduct.set(item.product_id, []);
      byProduct.get(item.product_id)!.push(enriched);
    }

    const packagingByProduct = new Map<number, ProductPackagingRow[]>();
    for (const line of packagingLines) {
      const set = setById.get(line.packaging_set_id);
      const enriched: ProductPackagingRow = {
        ...line,
        packaging_set_name: set?.name ?? '',
      };
      if (!packagingByProduct.has(line.product_id))
        packagingByProduct.set(line.product_id, []);
      packagingByProduct.get(line.product_id)!.push(enriched);
    }

    return products.map((p) => ({
      ...p,
      recipe: byProduct.get(p.id) || [],
      packaging: packagingByProduct.get(p.id) || [],
    }));
  },

  async getById(id: number) {
    const products = await this.getAll();
    return products.find((p) => p.id === id) ?? null;
  },

  async create(data: ProductInput) {
    const { recipe, packaging: pkgs, ...productFields } = data;
    const [product] = await db
      .insert(productsTable)
      .values({
        ...productFields,
        packaging_cost: data.packaging_cost ?? 0,
        selling_price: data.selling_price ?? null,
        created_at: new Date().toISOString().slice(0, 10),
      })
      .returning();
    const productId = product.id;
    for (const item of recipe) {
      await db.insert(recipeItemsTable).values({
        product_id: productId,
        ingredient_id: item.ingredient_id,
        qty: item.qty,
      });
    }
    for (const line of pkgs) {
      await db.insert(productPackagingTable).values({
        product_id: productId,
        packaging_set_id: line.packaging_set_id,
        qty: line.qty,
      });
    }
    return this.getById(productId);
  },

  async update(id: number, data: ProductInput) {
    const { recipe, packaging: pkgs, ...productFields } = data;
    await db.update(productsTable).set(productFields).where(eq(productsTable.id, id));
    await db.delete(recipeItemsTable).where(eq(recipeItemsTable.product_id, id));
    await db.delete(productPackagingTable).where(eq(productPackagingTable.product_id, id));
    for (const item of recipe) {
      await db.insert(recipeItemsTable).values({
        product_id: id,
        ingredient_id: item.ingredient_id,
        qty: item.qty,
      });
    }
    for (const line of pkgs) {
      await db.insert(productPackagingTable).values({
        product_id: id,
        packaging_set_id: line.packaging_set_id,
        qty: line.qty,
      });
    }
    return this.getById(id);
  },

  delete(id: number) {
    return db.delete(productsTable).where(eq(productsTable.id, id));
  },
};
