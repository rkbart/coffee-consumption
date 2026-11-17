import { db } from '../client';
import { settings } from '../schema';
import {
  ingredients as ingredientsTable,
  packaging as packagingTable,
  packagingSets as packagingSetsTable,
  packagingSetItems as packagingSetItemsTable,
  products as productsTable,
  closings as closingsTable,
} from '../schema';
import { eq } from 'drizzle-orm';
import { resetBusinessData } from './reset';
import { seedDemoData } from './demo-data';

const DEFAULT_CURRENCY = '₱';

/**
 * Run once on boot: ensure the shop has a default currency setting.
 * (One browser, one profile — no users, no auth.)
 */
export async function seed(): Promise<void> {
  const existing = await db.select().from(settings).where(eq(settings.key, 'currency'));
  if (existing.length === 0) {
    await db.insert(settings).values({ key: 'currency', value: DEFAULT_CURRENCY });
  }
}

/** Replace all business data with the sample café. Returns table counts. */
export async function loadDemo(): Promise<DataCounts> {
  await resetBusinessData();
  await seedDemoData();
  return dataCounts();
}

/** Delete all business data, keeping shop settings. */
export async function resetDatabase(): Promise<void> {
  await resetBusinessData();
}

export interface DataCounts {
  ingredients: number;
  packaging: number;
  packaging_sets: number;
  packaging_set_items: number;
  products: number;
  closings: number;
}

async function dataCounts(): Promise<DataCounts> {
  const [ingredients, packaging, packagingSets, packagingSetItems, products, closings] =
    await Promise.all([
      db.select().from(ingredientsTable),
      db.select().from(packagingTable),
      db.select().from(packagingSetsTable),
      db.select().from(packagingSetItemsTable),
      db.select().from(productsTable),
      db.select().from(closingsTable),
    ]);
  return {
    ingredients: ingredients.length,
    packaging: packaging.length,
    packaging_sets: packagingSets.length,
    packaging_set_items: packagingSetItems.length,
    products: products.length,
    closings: closings.length,
  };
}