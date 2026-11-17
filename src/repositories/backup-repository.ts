import { db } from '../db/client';
import {
  settings as settingsTable,
  ingredients as ingredientsTable,
  packagingSets as packagingSetsTable,
  packagingComponents as packagingComponentsTable,
  products as productsTable,
  recipeItems as recipeItemsTable,
  productPackaging as productPackagingTable,
  closings as closingsTable,
  closingLines as closingLinesTable,
  closingSales as closingSalesTable,
} from '../db/schema';
import { eq } from 'drizzle-orm';
import { resetBusinessData } from '../db/seed/reset';

const BACKUP_VERSION = '2';

const COLUMNS = [
  'record_type',
  'key',
  'value',
  'name',
  'description',
  'category',
  'unit',
  'pack_price',
  'pack_size',
  'qty_needed',
  'qty',
  'waste_pct',
  'sort_order',
  'product_name',
  'size_label',
  'yield_qty',
  'provision_pct',
  'target_food_cost_pct',
  'vat_pct',
  'selling_price',
  'ingredient_name',
  'packaging_name',
  'date',
  'shift',
  'prepared_by',
  'notes',
  'opening',
  'deliveries',
  'waste',
  'closing',
  'actual_usage',
  'theoretical_usage',
  'variance',
  'quantity',
  'created_at',
] as const;

const text = (value: unknown) => String(value ?? '').trim();
const number = (value: unknown, fallback = 0) => {
  const parsed = Number(text(value));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const csvCell = (value: unknown) => {
  const string = String(value ?? '');
  return /[",\r\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
};

const csvRow = (recordType: string, values: Record<string, unknown> = {}) =>
  COLUMNS.map((column) =>
    csvCell(column === 'record_type' ? recordType : values[column] ?? ''),
  ).join(',');

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (quoted) {
      if (char === '"' && csv[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && csv[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export async function exportBackupCsv(): Promise<string> {
  const lines = [COLUMNS.join(',')];
  lines.push(csvRow('meta', { key: 'schema_version', value: BACKUP_VERSION }));
  lines.push(csvRow('meta', { key: 'exported_at', value: new Date().toISOString() }));

  for (const { key, value } of await db.select().from(settingsTable)) {
    lines.push(csvRow('setting', { key, value }));
  }

  for (const row of await db.select().from(ingredientsTable).orderBy(ingredientsTable.sort_order, ingredientsTable.name, ingredientsTable.id)) {
    lines.push(csvRow('ingredient', { name: row.name, category: row.category, unit: row.unit, pack_price: row.pack_price, pack_size: row.pack_size, waste_pct: row.waste_pct, sort_order: row.sort_order }));
  }

  for (const row of await db.select().from(packagingSetsTable).orderBy(packagingSetsTable.sort_order, packagingSetsTable.packaging_name, packagingSetsTable.id)) {
    lines.push(csvRow('packaging', { name: row.packaging_name, description: row.description, sort_order: row.sort_order, value: 'set-v2' }));
    for (const component of await db.select().from(packagingComponentsTable).where(eq(packagingComponentsTable.packaging_id, row.id)).orderBy(packagingComponentsTable.sort_order, packagingComponentsTable.id)) {
      lines.push(csvRow('packaging_component', {
        packaging_name: row.packaging_name,
        name: component.name,
        description: component.description,
        unit: component.unit,
        pack_price: component.pack_price,
        pack_size: component.pack_size,
        qty_needed: component.qty_needed,
        waste_pct: component.waste_pct,
        sort_order: component.sort_order,
      }));
    }
  }

  const products = await db.select().from(productsTable).orderBy(productsTable.category, productsTable.name, productsTable.size_label, productsTable.id);
  for (const product of products) {
    lines.push(csvRow('product', {
      name: product.name, category: product.category, size_label: product.size_label,
      yield_qty: product.yield_qty, provision_pct: product.provision_pct,
      target_food_cost_pct: product.target_food_cost_pct, vat_pct: product.vat_pct,
      selling_price: product.selling_price, created_at: product.created_at,
    }));
    for (const item of await db.select().from(recipeItemsTable).where(eq(recipeItemsTable.product_id, product.id)).orderBy(recipeItemsTable.id)) {
      const ingredient = (await db.select().from(ingredientsTable).where(eq(ingredientsTable.id, item.ingredient_id)))[0];
      lines.push(csvRow('recipe_item', { product_name: product.name, size_label: product.size_label, ingredient_name: ingredient?.name ?? '', qty: item.qty }));
    }
    for (const line of await db.select().from(productPackagingTable).where(eq(productPackagingTable.product_id, product.id)).orderBy(productPackagingTable.id)) {
      const material = (await db.select().from(packagingSetsTable).where(eq(packagingSetsTable.id, line.packaging_id)))[0];
      lines.push(csvRow('product_packaging', { product_name: product.name, size_label: product.size_label, packaging_name: material?.packaging_name ?? '', qty: line.qty }));
    }
  }

  const closings = await db.select().from(closingsTable).orderBy(closingsTable.date, closingsTable.id);
  for (const closing of closings) {
    lines.push(csvRow('closing', { date: closing.date, shift: closing.shift, prepared_by: closing.prepared_by, notes: closing.notes, created_at: closing.created_at }));
    for (const line of await db.select().from(closingLinesTable).where(eq(closingLinesTable.closing_id, closing.id)).orderBy(closingLinesTable.id)) {
      lines.push(csvRow('closing_line', {
        date: closing.date, shift: closing.shift, ingredient_name: line.ingredient_name, unit: line.unit,
        opening: line.opening, deliveries: line.deliveries, waste: line.waste, closing: line.closing,
        actual_usage: line.actual_usage, theoretical_usage: line.theoretical_usage, variance: line.variance,
      }));
    }
    for (const sale of await db.select().from(closingSalesTable).where(eq(closingSalesTable.closing_id, closing.id)).orderBy(closingSalesTable.id)) {
      lines.push(csvRow('closing_sale', {
        date: closing.date, shift: closing.shift, product_name: sale.product_name, size_label: sale.size_label, quantity: sale.quantity,
      }));
    }
  }

  return lines.join('\n');
}

const productKey = (name: string, size: string) => `${text(name)}\u0000${text(size)}`;
const closingKey = (date: string, shift: string) => `${text(date)}\u0000${text(shift)}`;

export async function importBackupCsv(csv: string): Promise<{ ok: boolean; counts: { ingredients: number; packaging: number; products: number; closings: number } }> {
  const rows = parseCsvRows(csv).filter((row) => row.some((cell) => cell.length > 0));
  if (rows.length === 0) throw new Error('Empty backup file.');

  const header = rows[0].map((c) => c.trim());
  const colIndex = (name: string) => header.indexOf(name);

  const records: { type: string; values: Record<string, string> }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const values: Record<string, string> = {};
    for (const column of COLUMNS) {
      values[column] = cells[colIndex(column)] ?? '';
    }
    records.push({ type: values.record_type, values });
  }

  const settingsRows = records.filter((r) => r.type === 'setting');
  const ingredientRows = records.filter((r) => r.type === 'ingredient');
  const packagingRows = records.filter((r) => r.type === 'packaging');
  const packagingComponentRows = records.filter((r) => r.type === 'packaging_component');
  const productRows = records.filter((r) => r.type === 'product');
  const recipeItemRows = records.filter((r) => r.type === 'recipe_item');
  const productPackagingRows = records.filter((r) => r.type === 'product_packaging');
  const closingRows = records.filter((r) => r.type === 'closing');
  const closingLineRows = records.filter((r) => r.type === 'closing_line');
  const closingSaleRows = records.filter((r) => r.type === 'closing_sale');

  await resetBusinessData();

  for (const { values } of settingsRows) {
    await db.insert(settingsTable).values({ key: values.key, value: values.value });
  }

  const ingredientIdByKey = new Map<string, number>();
  for (const { values } of ingredientRows) {
    const [row] = await db.insert(ingredientsTable).values({
      name: values.name,
      category: values.category || 'Other',
      unit: values.unit || 'g',
      pack_price: number(values.pack_price),
      pack_size: number(values.pack_size) || 1,
      waste_pct: number(values.waste_pct),
      sort_order: number(values.sort_order),
    }).returning();
    ingredientIdByKey.set(values.name, row.id);
  }

  const packagingIdByKey = new Map<string, number>();
  for (const { values } of packagingRows) {
    const [row] = await db.insert(packagingSetsTable).values({
      packaging_name: values.name,
      description: values.description || '',
      sort_order: number(values.sort_order),
    }).returning();
    packagingIdByKey.set(values.name, row.id);
    if (values.value !== 'set-v2') {
      await db.insert(packagingComponentsTable).values({
        packaging_id: row.id,
        name: values.name,
        description: values.description || '',
        unit: values.unit || 'pcs',
        pack_price: number(values.pack_price),
        pack_size: number(values.pack_size) || 1,
        qty_needed: number(values.qty_needed) || 1,
        waste_pct: number(values.waste_pct),
        sort_order: 0,
      });
    }
  }

  for (const { values } of packagingComponentRows) {
    const packagingId = packagingIdByKey.get(values.packaging_name);
    if (!packagingId) continue;
    await db.insert(packagingComponentsTable).values({
      packaging_id: packagingId,
      name: values.name,
      description: values.description || '',
      unit: values.unit || 'pcs',
      pack_price: number(values.pack_price),
      pack_size: number(values.pack_size) || 1,
      qty_needed: number(values.qty_needed) || 1,
      waste_pct: number(values.waste_pct),
      sort_order: number(values.sort_order),
    });
  }

  const productIdByKey = new Map<string, number>();
  for (const { values } of productRows) {
    const [row] = await db.insert(productsTable).values({
      name: values.name,
      category: values.category || 'Coffee',
      size_label: values.size_label || '',
      yield_qty: number(values.yield_qty) || 1,
      packaging_cost: number(values.packaging_cost),
      provision_pct: number(values.provision_pct) || 20,
      target_food_cost_pct: number(values.target_food_cost_pct) || 33,
      vat_pct: number(values.vat_pct) || 12,
      selling_price: values.selling_price ? number(values.selling_price) : null,
      created_at: values.created_at || new Date().toISOString().slice(0, 10),
    }).returning();
    productIdByKey.set(productKey(values.name, values.size_label), row.id);
  }

  for (const { values } of recipeItemRows) {
    const productId = productIdByKey.get(productKey(values.product_name, values.size_label));
    const ingredientId = ingredientIdByKey.get(values.ingredient_name);
    if (productId && ingredientId) {
      await db.insert(recipeItemsTable).values({ product_id: productId, ingredient_id: ingredientId, qty: number(values.qty) });
    }
  }

  for (const { values } of productPackagingRows) {
    const productId = productIdByKey.get(productKey(values.product_name, values.size_label));
    const packagingId = packagingIdByKey.get(values.packaging_name);
    if (productId && packagingId) {
      await db.insert(productPackagingTable).values({ product_id: productId, packaging_id: packagingId, qty: number(values.qty) });
    }
  }

  const closingIdByKey = new Map<string, number>();
  for (const { values } of closingRows) {
    const [row] = await db.insert(closingsTable).values({
      date: values.date,
      shift: values.shift || 'pm',
      prepared_by: values.prepared_by || '',
      notes: values.notes || '',
      created_at: values.created_at || new Date().toISOString().slice(0, 10),
    }).returning();
    closingIdByKey.set(closingKey(values.date, values.shift || 'pm'), row.id);
  }

  for (const { values } of closingLineRows) {
    const closingId = closingIdByKey.get(closingKey(values.date, values.shift || 'pm'));
    const ingredientId = ingredientIdByKey.get(values.ingredient_name) ?? 0;
    if (closingId) {
      await db.insert(closingLinesTable).values({
        closing_id: closingId,
        ingredient_id: ingredientId,
        ingredient_name: values.ingredient_name,
        unit: values.unit,
        opening: number(values.opening),
        deliveries: number(values.deliveries),
        waste: number(values.waste),
        closing: number(values.closing),
        actual_usage: number(values.actual_usage),
        theoretical_usage: number(values.theoretical_usage),
        variance: number(values.variance),
      });
    }
  }

  for (const { values } of closingSaleRows) {
    if (number(values.quantity) <= 0) continue;
    const closingId = closingIdByKey.get(closingKey(values.date, values.shift || 'pm'));
    const productId = productIdByKey.get(productKey(values.product_name, values.size_label));
    if (closingId) {
      await db.insert(closingSalesTable).values({
        closing_id: closingId,
        product_id: productId ?? null,
        product_name: values.product_name,
        size_label: values.size_label || '',
        quantity: number(values.quantity),
      });
    }
  }

  const counts = {
    ingredients: ingredientRows.length,
    packaging: packagingRows.length,
    products: productRows.length,
    closings: closingRows.length,
  };
  return { ok: true, counts };
}
