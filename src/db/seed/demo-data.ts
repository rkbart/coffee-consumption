import { db } from '../client';
import {
  ingredients as ingredientsTable,
  products as productsTable,
  recipeItems as recipeItemsTable,
  closings as closingsTable,
  closingLines as closingLinesTable,
  closingSales as closingSalesTable,
} from '../schema';
import { eq } from 'drizzle-orm';
import { round2 } from '../../lib';

const costDefaults = {
  packaging_cost: 8,
  provision_pct: 20,
  target_food_cost_pct: 33,
  vat_pct: 12,
  yield_qty: 1,
};

const seedIngredients = [
  { name: 'Espresso Beans', unit: 'g', category: 'Coffee', pack_price: 1100, pack_size: 1000, waste_pct: 0, sort_order: 1 },
  { name: 'Decaf Beans', unit: 'g', category: 'Coffee', pack_price: 1300, pack_size: 1000, waste_pct: 0, sort_order: 2 },
  { name: 'Whole Milk', unit: 'ml', category: 'Dairy', pack_price: 100, pack_size: 1000, waste_pct: 0, sort_order: 3 },
  { name: 'Oat Milk', unit: 'ml', category: 'Dairy', pack_price: 180, pack_size: 1000, waste_pct: 2, sort_order: 4 },
];

const seedProducts = [
  { name: 'Cappuccino', category: 'Espresso', size_label: '8 oz', recipe: { 'Espresso Beans': 7, 'Whole Milk': 150 }, selling_price: 120 },
  { name: 'Cappuccino', category: 'Espresso', size_label: '12 oz', recipe: { 'Espresso Beans': 9, 'Whole Milk': 210 }, selling_price: 155 },
  { name: 'Flat White', category: 'Espresso', size_label: '6 oz', recipe: { 'Espresso Beans': 14, 'Whole Milk': 160 }, selling_price: 160 },
  { name: 'Caffè Latte', category: 'Espresso', size_label: '12 oz', recipe: { 'Espresso Beans': 9, 'Whole Milk': 240 }, selling_price: 170 },
  { name: 'Americano', category: 'Espresso', size_label: '8 oz', recipe: { 'Espresso Beans': 7 }, selling_price: 85 },
  { name: 'Decaf Americano', category: 'Espresso', size_label: '8 oz', recipe: { 'Decaf Beans': 7 }, selling_price: 90 },
  { name: 'Cortado', category: 'Espresso', size_label: '4 oz', recipe: { 'Espresso Beans': 14, 'Whole Milk': 90 }, selling_price: 130 },
  { name: 'Oat Cappuccino', category: 'Espresso', size_label: '8 oz', recipe: { 'Espresso Beans': 7, 'Oat Milk': 150 }, selling_price: 175 },
];

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

/**
 * Insert one closing whose closing stock is chosen so the resulting variance
 * matches `variances`, making the demo history physically coherent.
 */
async function seedClosing(
  date: Date,
  shift: string,
  openings: Record<string, { opening?: number; deliveries?: number } | number>,
  sales: { productName: string; sizeLabel: string; quantity: number }[],
  variances: Record<string, number>,
  notes: string,
  preparedBy = 'Maya',
) {
  const allIngredients = await db.select().from(ingredientsTable);
  const allProducts = await db.select().from(productsTable);

  const soldByProduct = new Map<number, number>();
  for (const s of sales) {
    const product = allProducts.find((p) => p.name === s.productName && p.size_label === s.sizeLabel);
    if (product) soldByProduct.set(product.id, (soldByProduct.get(product.id) || 0) + s.quantity);
  }
  const theoretical = new Map<number, number>(allIngredients.map((i) => [i.id, 0]));
  for (const product of allProducts) {
    const qty = soldByProduct.get(product.id) || 0;
    if (!qty) continue;
    const portions = product.yield_qty > 0 ? product.yield_qty : 1;
    const recipeRows = await db.select().from(recipeItemsTable).where(eq(recipeItemsTable.product_id, product.id));
    for (const line of recipeRows) {
      theoretical.set(line.ingredient_id, (theoretical.get(line.ingredient_id) || 0) + (line.qty / portions) * qty);
    }
  }

  const lines = allIngredients.map((ingredient) => {
    const raw = openings[ingredient.name];
    const opening = typeof raw === 'number' ? raw : raw?.opening ?? 0;
    const deliveries = typeof raw === 'number' ? 0 : raw?.deliveries ?? 0;
    const theoreticalUsage = round2(theoretical.get(ingredient.id) || 0);
    const variance = variances[ingredient.name] ?? 0;
    const closing = round2(opening + deliveries - theoreticalUsage - variance);
    const actual_usage = round2(opening + deliveries - closing);
    return {
      closing_id: 0,
      ingredient_id: ingredient.id,
      ingredient_name: ingredient.name,
      unit: ingredient.unit,
      opening: round2(opening),
      deliveries: round2(deliveries),
      waste: 0,
      closing,
      actual_usage,
      theoretical_usage: theoreticalUsage,
      variance: round2(actual_usage - theoreticalUsage),
    };
  });

  const [closing] = await db.insert(closingsTable)
    .values({ date: isoDate(date), shift, prepared_by: preparedBy, notes, created_at: isoDate(date) })
    .returning();
  const closingId = closing.id;

  for (const line of lines) {
    await db.insert(closingLinesTable).values({ ...line, closing_id: closingId });
  }

  for (const s of sales) {
    if (s.quantity <= 0) continue;
    const product = allProducts.find((p) => p.name === s.productName && p.size_label === s.sizeLabel);
    await db.insert(closingSalesTable).values({
      closing_id: closingId,
      product_id: product?.id ?? null,
      product_name: s.productName,
      size_label: s.sizeLabel,
      quantity: s.quantity,
    });
  }
}

export async function seedDemoData() {
  for (const i of seedIngredients) {
    await db.insert(ingredientsTable).values(i);
  }

  for (const p of seedProducts) {
    const { recipe, ...rest } = p;
    const [product] = await db.insert(productsTable)
      .values({
        ...rest,
        packaging_cost: costDefaults.packaging_cost,
        provision_pct: costDefaults.provision_pct,
        target_food_cost_pct: costDefaults.target_food_cost_pct,
        vat_pct: costDefaults.vat_pct,
        yield_qty: costDefaults.yield_qty,
        created_at: isoDate(new Date()),
      })
      .returning();
    const productId = product.id;
    const ingredientByName = new Map(
      (await db.select().from(ingredientsTable)).map((i) => [i.name, i]),
    );
    for (const [ingredientName, qty] of Object.entries(recipe)) {
      const ingredient = ingredientByName.get(ingredientName);
      if (ingredient) {
        await db.insert(recipeItemsTable).values({
          product_id: productId,
          ingredient_id: ingredient.id,
          qty,
        });
      }
    }
  }

  await seedClosing(
    daysAgo(3), 'pm',
    { 'Espresso Beans': { opening: 3500 }, 'Decaf Beans': { opening: 300 }, 'Whole Milk': { opening: 8000 }, 'Oat Milk': { opening: 3000 } },
    [
      { productName: 'Cappuccino', sizeLabel: '8 oz', quantity: 44 },
      { productName: 'Cappuccino', sizeLabel: '12 oz', quantity: 26 },
      { productName: 'Caffè Latte', sizeLabel: '12 oz', quantity: 31 },
      { productName: 'Flat White', sizeLabel: '6 oz', quantity: 16 },
      { productName: 'Americano', sizeLabel: '8 oz', quantity: 21 },
      { productName: 'Oat Cappuccino', sizeLabel: '8 oz', quantity: 12 },
    ],
    { 'Espresso Beans': -6, 'Whole Milk': 40 },
    'Steady weekday. Oat milk running low, add to Friday\'s order.',
    'Maya',
  );

  await seedClosing(
    daysAgo(2), 'pm',
    { 'Espresso Beans': { opening: 2800, deliveries: 1000 }, 'Decaf Beans': { opening: 300 }, 'Whole Milk': { opening: 6000, deliveries: 6000 }, 'Oat Milk': { opening: 2000, deliveries: 6000 } },
    [
      { productName: 'Cappuccino', sizeLabel: '8 oz', quantity: 49 },
      { productName: 'Cappuccino', sizeLabel: '12 oz', quantity: 29 },
      { productName: 'Caffè Latte', sizeLabel: '12 oz', quantity: 34 },
      { productName: 'Flat White', sizeLabel: '6 oz', quantity: 18 },
      { productName: 'Americano', sizeLabel: '8 oz', quantity: 24 },
      { productName: 'Cortado', sizeLabel: '4 oz', quantity: 11 },
      { productName: 'Oat Cappuccino', sizeLabel: '8 oz', quantity: 17 },
    ],
    { 'Espresso Beans': 11, 'Whole Milk': -60, 'Oat Milk': 30 },
    'Restocked oat milk and beans at open.',
    'Maya',
  );

  await seedClosing(
    daysAgo(1), 'pm',
    { 'Espresso Beans': { opening: 2900 }, 'Decaf Beans': { opening: 290 }, 'Whole Milk': { opening: 8000 }, 'Oat Milk': { opening: 4500 } },
    [
      { productName: 'Cappuccino', sizeLabel: '8 oz', quantity: 38 },
      { productName: 'Cappuccino', sizeLabel: '12 oz', quantity: 21 },
      { productName: 'Caffè Latte', sizeLabel: '12 oz', quantity: 27 },
      { productName: 'Flat White', sizeLabel: '6 oz', quantity: 14 },
      { productName: 'Americano', sizeLabel: '8 oz', quantity: 23 },
      { productName: 'Oat Cappuccino', sizeLabel: '8 oz', quantity: 15 },
      { productName: 'Decaf Americano', sizeLabel: '8 oz', quantity: 3 },
    ],
    { 'Espresso Beans': 7, 'Whole Milk': 150 },
    'Variance looks like one cappuccino that never hit the till — two comps for the roaster visit.',
    'Maya',
  );
}
