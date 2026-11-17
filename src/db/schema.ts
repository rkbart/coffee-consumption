import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

/**
 * Brew Ledger schema — one SQLite database in OPFS (via sqlocal), one profile
 * per browser/origin. No users, no auth: a single shop's catalogue and closing
 * history live here.
 *
 * Column names stay snake_case to match the existing TypeScript types and the
 * repository layer, so nothing downstream needs to change.
 */

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const ingredients = sqliteTable('ingredients', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  unit: text('unit').notNull(),
  category: text('category').notNull().default('Other'),
  pack_price: real('pack_price').notNull().default(0),
  pack_size: real('pack_size').notNull().default(1),
  waste_pct: real('waste_pct').notNull().default(0),
  sort_order: integer('sort_order').notNull().default(0),
});

export const packaging = sqliteTable('packaging', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  unit: text('unit').notNull().default('pcs'),
  pack_price: real('pack_price').notNull().default(0),
  pack_size: real('pack_size').notNull().default(1),
  waste_pct: real('waste_pct').notNull().default(0),
  sort_order: integer('sort_order').notNull().default(0),
});

export const products = sqliteTable('products', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull().default('Coffee'),
  size_label: text('size_label').notNull().default(''),
  yield_qty: real('yield_qty').notNull().default(1),
  packaging_cost: real('packaging_cost').notNull().default(0),
  provision_pct: real('provision_pct').notNull().default(20),
  target_food_cost_pct: real('target_food_cost_pct').notNull().default(33),
  vat_pct: real('vat_pct').notNull().default(12),
  selling_price: real('selling_price'),
  created_at: text('created_at').notNull(),
});

export const recipeItems = sqliteTable('recipe_items', {
  id: integer('id').primaryKey(),
  product_id: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  ingredient_id: integer('ingredient_id')
    .notNull()
    .references(() => ingredients.id, { onDelete: 'restrict' }),
  qty: real('qty').notNull().default(0),
}, (t) => ({
  productIdx: index('recipe_items_product_idx').on(t.product_id),
}));

export const productPackaging = sqliteTable('product_packaging', {
  id: integer('id').primaryKey(),
  product_id: integer('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  packaging_id: integer('packaging_id')
    .notNull()
    .references(() => packaging.id, { onDelete: 'restrict' }),
  qty: real('qty').notNull().default(1),
}, (t) => ({
  productIdx: index('product_packaging_product_idx').on(t.product_id),
}));

export const closings = sqliteTable('closings', {
  id: integer('id').primaryKey(),
  date: text('date').notNull(),
  shift: text('shift').notNull().default('pm'),
  prepared_by: text('prepared_by').notNull().default(''),
  notes: text('notes').notNull().default(''),
  created_at: text('created_at').notNull(),
}, (t) => ({
  dateIdx: index('closings_date_idx').on(t.date),
}));

export const closingLines = sqliteTable('closing_lines', {
  id: integer('id').primaryKey(),
  closing_id: integer('closing_id')
    .notNull()
    .references(() => closings.id, { onDelete: 'cascade' }),
  ingredient_id: integer('ingredient_id').notNull(),
  ingredient_name: text('ingredient_name').notNull(),
  unit: text('unit').notNull(),
  opening: real('opening').notNull().default(0),
  deliveries: real('deliveries').notNull().default(0),
  waste: real('waste').notNull().default(0),
  closing: real('closing').notNull().default(0),
  actual_usage: real('actual_usage').notNull().default(0),
  theoretical_usage: real('theoretical_usage').notNull().default(0),
  variance: real('variance').notNull().default(0),
}, (t) => ({
  closingIdx: index('closing_lines_closing_idx').on(t.closing_id),
}));

export const closingSales = sqliteTable('closing_sales', {
  id: integer('id').primaryKey(),
  closing_id: integer('closing_id')
    .notNull()
    .references(() => closings.id, { onDelete: 'cascade' }),
  product_id: integer('product_id'),
  product_name: text('product_name').notNull(),
  size_label: text('size_label').notNull().default(''),
  quantity: integer('quantity').notNull().default(0),
}, (t) => ({
  closingIdx: index('closing_sales_closing_idx').on(t.closing_id),
}));