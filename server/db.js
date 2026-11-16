import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeUsage, round2 } from "./variance.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath =
  process.env.BREW_DB_PATH || join(__dirname, "..", "data", "brew.db");

mkdirSync(dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
  CREATE TABLE IF NOT EXISTS ingredients (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    unit        TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'pcs')),
    category    TEXT NOT NULL DEFAULT 'Other',
    pack_price  REAL NOT NULL DEFAULT 0,
    pack_size   REAL NOT NULL DEFAULT 1,
    waste_pct   REAL NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'Coffee',
    size_label  TEXT NOT NULL DEFAULT '',
    yield_qty   REAL NOT NULL DEFAULT 1,
    packaging_cost REAL NOT NULL DEFAULT 0,
    provision_pct REAL NOT NULL DEFAULT 20,
    target_food_cost_pct REAL NOT NULL DEFAULT 33,
    vat_pct     REAL NOT NULL DEFAULT 12,
    selling_price REAL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recipe_items (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    qty           REAL NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_recipe_product ON recipe_items(product_id);

  CREATE TABLE IF NOT EXISTS packaging (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    unit        TEXT NOT NULL DEFAULT 'pcs' CHECK (unit IN ('g', 'ml', 'pcs')),
    pack_price  REAL NOT NULL DEFAULT 0,
    pack_size   REAL NOT NULL DEFAULT 1,
    waste_pct   REAL NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS product_packaging (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    packaging_id INTEGER NOT NULL REFERENCES packaging(id) ON DELETE RESTRICT,
    qty          REAL NOT NULL DEFAULT 1
  );
  CREATE INDEX IF NOT EXISTS idx_product_packaging ON product_packaging(product_id);

  CREATE TABLE IF NOT EXISTS closings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT NOT NULL,
    shift       TEXT NOT NULL DEFAULT 'pm',
    prepared_by TEXT NOT NULL DEFAULT '',
    notes       TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (date, shift)
  );
  CREATE INDEX IF NOT EXISTS idx_closings_date ON closings(date);

  CREATE TABLE IF NOT EXISTS closing_lines (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    closing_id       INTEGER NOT NULL REFERENCES closings(id) ON DELETE CASCADE,
    ingredient_id    INTEGER NOT NULL REFERENCES ingredients(id),
    ingredient_name  TEXT NOT NULL,
    unit             TEXT NOT NULL,
    opening          REAL NOT NULL DEFAULT 0,
    deliveries       REAL NOT NULL DEFAULT 0,
    waste            REAL NOT NULL DEFAULT 0,
    closing          REAL NOT NULL DEFAULT 0,
    actual_usage     REAL NOT NULL DEFAULT 0,
    theoretical_usage REAL NOT NULL DEFAULT 0,
    variance         REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS closing_sales (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    closing_id    INTEGER NOT NULL REFERENCES closings(id) ON DELETE CASCADE,
    product_id    INTEGER,
    product_name  TEXT NOT NULL,
    size_label    TEXT NOT NULL DEFAULT '',
    quantity      INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

db.prepare(
  "INSERT OR IGNORE INTO settings (key, value) VALUES ('currency', '₱')",
).run();

export const DEFAULT_CURRENCY = "₱";

export function getSettings() {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    currency: stored.currency || DEFAULT_CURRENCY,
  };
}

export function updateSettings({ currency }) {
  if (currency !== undefined) {
    db.prepare(
      `INSERT INTO settings (key, value) VALUES ('currency', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run(currency);
  }
  return getSettings();
}

export function dataCounts() {
  const count = (table) =>
    Number(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n);
  return {
    ingredients: count("ingredients"),
    packaging: count("packaging"),
    products: count("products"),
    closings: count("closings"),
  };
}

/* ----------------------------- migrations for databases created before cost */

function ensureColumns(table, columns) {
  const existing = new Set(
    db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name),
  );
  for (const [name, definition] of Object.entries(columns)) {
    if (!existing.has(name)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    }
  }
}

ensureColumns("ingredients", {
  pack_price: "REAL NOT NULL DEFAULT 0",
  pack_size: "REAL NOT NULL DEFAULT 1",
  waste_pct: "REAL NOT NULL DEFAULT 0",
});

ensureColumns("products", {
  yield_qty: "REAL NOT NULL DEFAULT 1",
  packaging_cost: "REAL NOT NULL DEFAULT 0",
  provision_pct: "REAL NOT NULL DEFAULT 20",
  target_food_cost_pct: "REAL NOT NULL DEFAULT 33",
  vat_pct: "REAL NOT NULL DEFAULT 12",
  selling_price: "REAL",
});

export const SHIFT_IDS = ["am", "mid", "pm", "gy"];
export const SHIFT_ORDER = { am: 0, mid: 1, pm: 2, gy: 3 };
const shiftCase = `CASE shift WHEN 'am' THEN 0 WHEN 'mid' THEN 1 WHEN 'pm' THEN 2 WHEN 'gy' THEN 3 ELSE 3 END`;

/**
 * Older databases allowed only one closing per date. Rebuild that table so a
 * day can hold one snapshot per shift. Existing rows become the closing (PM)
 * shift, which is what the original end-of-day count represented.
 */
function migrateClosingsForShifts() {
  const columns = new Set(
    db.prepare("PRAGMA table_info(closings)").all().map((column) => column.name),
  );
  const { sql } = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'closings'")
    .get();
  if (columns.has("shift") && columns.has("prepared_by") && !/date\s+TEXT\s+NOT NULL\s+UNIQUE/i.test(sql))
    return;

  const shiftExpr = columns.has("shift") ? "shift" : "'pm'";
  const preparedExpr = columns.has("prepared_by") ? "prepared_by" : "''";
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("BEGIN");
  try {
    db.exec(`
      CREATE TABLE closings_new (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        date        TEXT NOT NULL,
        shift       TEXT NOT NULL DEFAULT 'pm',
        prepared_by TEXT NOT NULL DEFAULT '',
        notes       TEXT NOT NULL DEFAULT '',
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (date, shift)
      )
    `);
    db.exec(`
      INSERT INTO closings_new (id, date, shift, prepared_by, notes, created_at)
      SELECT id, date, ${shiftExpr}, ${preparedExpr}, notes, created_at FROM closings
    `);
    db.exec("DROP TABLE closings");
    db.exec("ALTER TABLE closings_new RENAME TO closings");
    db.exec("CREATE INDEX IF NOT EXISTS idx_closings_date ON closings(date)");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

migrateClosingsForShifts();

export function getIngredients() {
  return db
    .prepare("SELECT * FROM ingredients ORDER BY sort_order, name")
    .all();
}

export function getPackaging() {
  return db.prepare("SELECT * FROM packaging ORDER BY sort_order, name").all();
}

export function getProducts() {
  const products = db
    .prepare("SELECT * FROM products ORDER BY category, name, size_label")
    .all();

  const items = db
    .prepare(
      `SELECT ri.id, ri.product_id, ri.ingredient_id, ri.qty,
              i.name AS ingredient_name, i.unit
         FROM recipe_items ri
         JOIN ingredients i ON i.id = ri.ingredient_id
        ORDER BY i.sort_order, i.name`,
    )
    .all();

  const byProduct = new Map();
  for (const item of items) {
    if (!byProduct.has(item.product_id)) byProduct.set(item.product_id, []);
    byProduct.get(item.product_id).push(item);
  }

  const packagingLines = db
    .prepare(
      `SELECT pp.id, pp.product_id, pp.packaging_id, pp.qty,
              p.name AS packaging_name, p.unit
         FROM product_packaging pp
         JOIN packaging p ON p.id = pp.packaging_id
        ORDER BY p.sort_order, p.name`,
    )
    .all();
  const packagingByProduct = new Map();
  for (const line of packagingLines) {
    if (!packagingByProduct.has(line.product_id))
      packagingByProduct.set(line.product_id, []);
    packagingByProduct.get(line.product_id).push(line);
  }

  return products.map((p) => ({
    ...p,
    recipe: byProduct.get(p.id) || [],
    packaging: packagingByProduct.get(p.id) || [],
  }));
}

export function getClosingByDate(date, shift) {
  return db
    .prepare("SELECT * FROM closings WHERE date = ? AND shift = ?")
    .get(date, shift);
}

export function closingsForDate(date) {
  return db
    .prepare(
      `SELECT id, date, shift, prepared_by, created_at
         FROM closings
        WHERE date = ?
        ORDER BY ${shiftCase}`,
    )
    .all(date);
}

export function getClosingDetail(id) {
  const closing = db.prepare("SELECT * FROM closings WHERE id = ?").get(id);
  if (!closing) return null;
  const lines = db
    .prepare("SELECT * FROM closing_lines WHERE closing_id = ? ORDER BY id")
    .all(id);
  const sales = db
    .prepare("SELECT * FROM closing_sales WHERE closing_id = ? ORDER BY id")
    .all(id);
  return { ...closing, lines, sales };
}

/** The most recent closing before a date + shift, in AM → MID → PM → GY order. */
export function previousClosingFor(date, shift) {
  const rank = SHIFT_ORDER[shift] ?? 0;
  const previous = db
    .prepare(
      `SELECT * FROM closings
        WHERE date < ? OR (date = ? AND ${shiftCase} < ?)
        ORDER BY date DESC, ${shiftCase} DESC
        LIMIT 1`,
    )
    .get(date, date, rank);
  if (!previous) return null;
  const lines = db
    .prepare("SELECT * FROM closing_lines WHERE closing_id = ?")
    .all(previous.id);
  return { date: previous.date, shift: previous.shift, lines };
}

/**
 * Insert or replace one shift's closing, snapshotting the computed variance so
 * history stays intact even if recipes change later.
 */
export function saveClosing({
  date,
  shift = "pm",
  prepared_by = "",
  notes = "",
  counts = [],
  sales = [],
}) {
  const ingredients = getIngredients();
  const products = getProducts();
  const lines = computeUsage({ ingredients, products, sales, counts });

  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM closings WHERE date = ? AND shift = ?").run(date, shift);
    const result = db
      .prepare(
        "INSERT INTO closings (date, shift, prepared_by, notes) VALUES (?, ?, ?, ?)",
      )
      .run(date, shift, prepared_by, notes);
    const closingId = Number(result.lastInsertRowid);

    const insertLine = db.prepare(`
      INSERT INTO closing_lines
        (closing_id, ingredient_id, ingredient_name, unit, opening, deliveries,
         waste, closing, actual_usage, theoretical_usage, variance)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const line of lines) {
      insertLine.run(
        closingId,
        line.ingredient_id,
        line.name,
        line.unit,
        line.opening,
        line.deliveries,
        line.waste,
        line.closing,
        line.actual_usage,
        line.theoretical_usage,
        line.variance,
      );
    }

    const salesById = new Map(
      sales.map((s) => [Number(s.product_id), Number(s.quantity) || 0]),
    );
    const insertSale = db.prepare(`
      INSERT INTO closing_sales
        (closing_id, product_id, product_name, size_label, quantity)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const product of products) {
      const quantity = salesById.get(product.id) || 0;
      if (quantity > 0) {
        insertSale.run(
          closingId,
          product.id,
          product.name,
          product.size_label,
          quantity,
        );
      }
    }

    db.exec("COMMIT");
    return getClosingDetail(closingId);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function varianceTolerance(line) {
  return Math.max(2, Math.abs(line.theoretical_usage) * 0.02);
}

export function isFlagged(line) {
  return Math.abs(line.variance) > varianceTolerance(line);
}

export function listClosings() {
  const closings = db
    .prepare(
      `SELECT c.id, c.date, c.shift, c.prepared_by, c.notes, c.created_at,
              COUNT(l.id) AS ingredient_count
         FROM closings c
         LEFT JOIN closing_lines l ON l.closing_id = c.id
        GROUP BY c.id
        ORDER BY c.date DESC,
                 CASE c.shift WHEN 'am' THEN 0 WHEN 'mid' THEN 1 WHEN 'pm' THEN 2 WHEN 'gy' THEN 3 ELSE 3 END DESC`,
    )
    .all();

  const lines = db
    .prepare("SELECT closing_id, theoretical_usage, variance FROM closing_lines")
    .all();

  return closings.map((closing) => {
    const own = lines.filter((l) => l.closing_id === closing.id);
    return {
      ...closing,
      flagged_count: own.filter(isFlagged).length,
    };
  });
}

/**
 * Aggregate saved closings into one consumption report. Everything comes from
 * the closing snapshots, so a recipe changed today is not allowed to rewrite
 * what the owner already reported for last week.
 */
export function reportForRange(from, to) {
  const rows = db
    .prepare(
      "SELECT id FROM closings WHERE date >= ? AND date <= ? ORDER BY date ASC, id ASC",
    )
    .all(from, to);
  const details = rows.map((row) => getClosingDetail(row.id));

  const ingredientMap = new Map();
  const salesMap = new Map();
  const notes = [];
  let totalCups = 0;
  let flaggedLines = 0;
  let flaggedCloses = 0;

  for (const detail of details) {
    let closeFlagged = false;

    for (const line of detail.lines) {
      const key = `${line.ingredient_name}\u0000${line.unit}`;
      let entry = ingredientMap.get(key);
      if (!entry) {
        entry = {
          ingredient_id: line.ingredient_id,
          name: line.ingredient_name,
          unit: line.unit,
          first_date: detail.date,
          last_date: detail.date,
          opening: line.opening,
          deliveries: 0,
          waste: 0,
          ending_stock: line.closing,
          actual_usage: 0,
          theoretical_usage: 0,
          variance: 0,
          closing_count: 0,
          flagged_closes: 0,
        };
        ingredientMap.set(key, entry);
      }

      entry.last_date = detail.date;
      entry.ending_stock = line.closing;
      entry.deliveries += Number(line.deliveries) || 0;
      entry.waste += Number(line.waste) || 0;
      entry.actual_usage += Number(line.actual_usage) || 0;
      entry.theoretical_usage += Number(line.theoretical_usage) || 0;
      entry.variance += Number(line.variance) || 0;
      entry.closing_count += 1;

      if (isFlagged(line)) {
        entry.flagged_closes += 1;
        flaggedLines += 1;
        closeFlagged = true;
      }
    }

    for (const sale of detail.sales) {
      const key = `${sale.product_name}\u0000${sale.size_label || ""}`;
      const entry = salesMap.get(key) || {
        product_name: sale.product_name,
        size_label: sale.size_label || "",
        quantity: 0,
      };
      entry.quantity += Number(sale.quantity) || 0;
      totalCups += Number(sale.quantity) || 0;
      salesMap.set(key, entry);
    }

    const note = String(detail.notes || "").trim();
    if (note)
      notes.push({
        date: detail.date,
        shift: detail.shift,
        prepared_by: detail.prepared_by,
        notes: note,
      });
    if (closeFlagged) flaggedCloses += 1;
  }

  const lines = [...ingredientMap.values()]
    .map((entry) => {
      const actual = round2(entry.actual_usage);
      const theoretical = round2(entry.theoretical_usage);
      const variance = round2(entry.variance);
      return {
        ...entry,
        opening: round2(entry.opening),
        deliveries: round2(entry.deliveries),
        waste: round2(entry.waste),
        ending_stock: round2(entry.ending_stock),
        actual_usage: actual,
        theoretical_usage: theoretical,
        variance,
        variance_pct: theoretical ? round2((variance / theoretical) * 100) : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    from,
    to,
    generated_at: new Date().toISOString(),
    closing_count: details.length,
    total_cups: totalCups,
    flagged_lines: flaggedLines,
    flagged_closes: flaggedCloses,
    first_date: details[0]?.date ?? null,
    last_date: details[details.length - 1]?.date ?? null,
    lines,
    sales: [...salesMap.values()].sort((a, b) => b.quantity - a.quantity),
    notes,
    closings: details.map((detail) => ({
      id: detail.id,
      date: detail.date,
      shift: detail.shift,
      prepared_by: detail.prepared_by,
      notes: detail.notes,
      flagged_count: detail.lines.filter(isFlagged).length,
    })),
  };
}

/* ------------------------------------------------------------------ seed */

const seedIngredients = [
  { name: "Espresso Beans", unit: "g", category: "Coffee", pack_price: 1100, pack_size: 1000, waste_pct: 0, sort_order: 1 },
  { name: "Decaf Beans", unit: "g", category: "Coffee", pack_price: 1300, pack_size: 1000, waste_pct: 0, sort_order: 2 },
  { name: "Whole Milk", unit: "ml", category: "Dairy", pack_price: 100, pack_size: 1000, waste_pct: 0, sort_order: 3 },
  { name: "Oat Milk", unit: "ml", category: "Dairy", pack_price: 180, pack_size: 1000, waste_pct: 2, sort_order: 4 },
];

const seedProducts = [
  {
    name: "Cappuccino",
    category: "Espresso",
    size_label: "8 oz",
    recipe: { "Espresso Beans": 7, "Whole Milk": 150 },
    selling_price: 120,
  },
  {
    name: "Cappuccino",
    category: "Espresso",
    size_label: "12 oz",
    recipe: { "Espresso Beans": 9, "Whole Milk": 210 },
    selling_price: 155,
  },
  {
    name: "Flat White",
    category: "Espresso",
    size_label: "6 oz",
    recipe: { "Espresso Beans": 14, "Whole Milk": 160 },
    selling_price: 160,
  },
  {
    name: "Caffè Latte",
    category: "Espresso",
    size_label: "12 oz",
    recipe: { "Espresso Beans": 9, "Whole Milk": 240 },
    selling_price: 170,
  },
  {
    name: "Americano",
    category: "Espresso",
    size_label: "8 oz",
    recipe: { "Espresso Beans": 7 },
    selling_price: 85,
  },
  {
    name: "Decaf Americano",
    category: "Espresso",
    size_label: "8 oz",
    recipe: { "Decaf Beans": 7 },
    selling_price: 90,
  },
  {
    name: "Cortado",
    category: "Espresso",
    size_label: "4 oz",
    recipe: { "Espresso Beans": 14, "Whole Milk": 90 },
    selling_price: 130,
  },
  {
    name: "Oat Cappuccino",
    category: "Espresso",
    size_label: "8 oz",
    recipe: { "Espresso Beans": 7, "Oat Milk": 150 },
    selling_price: 175,
  },
];

const costDefaults = { packaging_cost: 8, provision_pct: 20, target_food_cost_pct: 33, vat_pct: 12, yield_qty: 1 };

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

/**
 * Seed a closing whose ending stock is derived from the recipes plus a chosen
 * variance, so the demo history is physically coherent rather than invented
 * numbers that do not reconcile.
 */
function seedClosing(date, openings, sales, variances, notes, preparedBy = "Maya") {
  const ingredients = getIngredients();
  const products = getProducts();
  const byName = new Map(ingredients.map((i) => [i.name, i.id]));

  const salesRows = sales.map((s) => ({
    product_id: products.find(
      (p) => p.name === s.name && p.size_label === s.size,
    )?.id,
    quantity: s.quantity,
  }));

  const theoretical = new Map(ingredients.map((i) => [i.id, 0]));
  for (const sale of salesRows) {
    const product = products.find((p) => p.id === sale.product_id);
    if (!product) continue;
    const portions = product.yield_qty > 0 ? product.yield_qty : 1;
    for (const line of product.recipe) {
      theoretical.set(
        line.ingredient_id,
        theoretical.get(line.ingredient_id) + (line.qty / portions) * sale.quantity,
      );
    }
  }

  const countRows = ingredients.map((ingredient) => {
    const state = openings[ingredient.name] || {};
    const opening = state.opening ?? 0;
    const deliveries = state.deliveries ?? 0;
    const waste = state.waste ?? 0;
    const actual = theoretical.get(ingredient.id) + (variances[ingredient.name] ?? 0);
    return {
      ingredient_id: ingredient.id,
      opening,
      deliveries,
      waste,
      closing: round2(opening + deliveries - waste - actual),
    };
  });

  saveClosing({
    date: isoDate(date),
    shift: "pm",
    prepared_by: preparedBy,
    notes,
    counts: countRows,
    sales: salesRows,
  });
}

/**
 * Packaging used to be a flat amount per drink. Turn each old amount into a
 * shared packaging material and a one-piece line, so the totals stay the same
 * until the shop replaces it with real cups and lids.
 */
function backfillLegacyPackaging() {
  const products = db
    .prepare(
      `SELECT p.id, p.packaging_cost
         FROM products p
        WHERE p.packaging_cost > 0
          AND NOT EXISTS (
            SELECT 1 FROM product_packaging pp WHERE pp.product_id = p.id
          )`,
    )
    .all();
  if (products.length === 0) return;

  const findMaterial = db.prepare("SELECT id FROM packaging WHERE name = ?");
  const insertMaterial = db.prepare(
    `INSERT INTO packaging (name, unit, pack_price, pack_size, waste_pct, sort_order)
     VALUES (?, 'pcs', ?, 1, 0,
       (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM packaging))`,
  );
  const insertLine = db.prepare(
    "INSERT INTO product_packaging (product_id, packaging_id, qty) VALUES (?, ?, 1)",
  );
  const clearCost = db.prepare("UPDATE products SET packaging_cost = 0 WHERE id = ?");

  for (const product of products) {
    const cost = Number(product.packaging_cost) || 0;
    const name =
      Math.abs(cost - 8) < 0.005
        ? "Standard cup & lid"
        : `Packaging (${cost.toFixed(2)})`;
    let material = findMaterial.get(name);
    if (!material) {
      const result = insertMaterial.run(name, cost);
      material = { id: Number(result.lastInsertRowid) };
    }
    insertLine.run(product.id, material.id);
    clearCost.run(product.id);
  }
}

/**
 * Add cost defaults to rows created by an older version of the app. Only fills
 * blanks, so any prices the shop has already typed in are left alone.
 */
function backfillSeedCosts() {
  const updateIngredient = db.prepare(`
    UPDATE ingredients SET pack_price = ?, pack_size = ?, waste_pct = ?
     WHERE name = ? AND (pack_price IS NULL OR pack_price = 0)
  `);
  for (const i of seedIngredients) {
    updateIngredient.run(i.pack_price, i.pack_size, i.waste_pct, i.name);
  }

  const updateProduct = db.prepare(`
    UPDATE products
       SET yield_qty = ?, provision_pct = ?,
           target_food_cost_pct = ?, vat_pct = ?, selling_price = ?
     WHERE name = ? AND size_label = ? AND selling_price IS NULL
  `);
  for (const p of seedProducts) {
    updateProduct.run(
      costDefaults.yield_qty,
      costDefaults.provision_pct,
      costDefaults.target_food_cost_pct,
      costDefaults.vat_pct,
      p.selling_price,
      p.name,
      p.size_label,
    );
  }
}

export function runDataMaintenance() {
  backfillSeedCosts();
  backfillLegacyPackaging();
}

/** Delete business data, leaving shop settings such as the currency intact. */
export function clearBusinessData() {
  for (const table of [
    "closing_sales",
    "closing_lines",
    "closings",
    "product_packaging",
    "recipe_items",
    "products",
    "packaging",
    "ingredients",
  ]) {
    db.exec(`DELETE FROM ${table}`);
  }
  db.exec(`
    DELETE FROM sqlite_sequence
     WHERE name IN ('closing_sales', 'closing_lines', 'closings',
                    'product_packaging', 'recipe_items', 'products',
                    'packaging', 'ingredients')
  `);
}

export function resetDatabase() {
  db.exec("BEGIN");
  try {
    clearBusinessData();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** Insert the demonstration catalogue and history. The caller resets first. */
function insertDemoData() {
  db.exec("BEGIN");
  try {
    const insertIngredient = db.prepare(
      `INSERT INTO ingredients
        (name, unit, category, pack_price, pack_size, waste_pct, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const i of seedIngredients) {
      insertIngredient.run(
        i.name,
        i.unit,
        i.category,
        i.pack_price,
        i.pack_size,
        i.waste_pct,
        i.sort_order,
      );
    }

    const insertProduct = db.prepare(
      `INSERT INTO products
        (name, category, size_label, yield_qty, packaging_cost,
         provision_pct, target_food_cost_pct, vat_pct, selling_price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertRecipe = db.prepare(
      "INSERT INTO recipe_items (product_id, ingredient_id, qty) VALUES (?, ?, ?)",
    );
    const ingredientByName = new Map(
      seedIngredients.map((i) => [
        i.name,
        db
          .prepare("SELECT id FROM ingredients WHERE name = ?")
          .get(i.name).id,
      ]),
    );
    for (const p of seedProducts) {
      const { lastInsertRowid } = insertProduct.run(
        p.name,
        p.category,
        p.size_label,
        costDefaults.yield_qty,
        costDefaults.packaging_cost,
        costDefaults.provision_pct,
        costDefaults.target_food_cost_pct,
        costDefaults.vat_pct,
        p.selling_price,
      );
      for (const [name, qty] of Object.entries(p.recipe)) {
        insertRecipe.run(Number(lastInsertRowid), ingredientByName.get(name), qty);
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  backfillLegacyPackaging();

  // Three closings that reconcile. Thursday runs tight, Friday was calm, and
  // Saturday carries the story: 7g of beans and 150ml of milk beyond the till
  // — roughly one unrecorded cappuccino.
  seedClosing(
    daysAgo(3),
    { "Espresso Beans": { opening: 3500 }, "Decaf Beans": { opening: 300 },
      "Whole Milk": { opening: 8000 }, "Oat Milk": { opening: 3000 } },
    [
      { name: "Cappuccino", size: "8 oz", quantity: 44 },
      { name: "Cappuccino", size: "12 oz", quantity: 26 },
      { name: "Caffè Latte", size: "12 oz", quantity: 31 },
      { name: "Flat White", size: "6 oz", quantity: 16 },
      { name: "Americano", size: "8 oz", quantity: 21 },
      { name: "Oat Cappuccino", size: "8 oz", quantity: 12 },
    ],
    { "Espresso Beans": -6, "Decaf Beans": 0, "Whole Milk": 40, "Oat Milk": 0 },
    "Steady weekday. Oat milk running low, add to Friday's order.",
  );

  seedClosing(
    daysAgo(2),
    { "Espresso Beans": { opening: 2800, deliveries: 1000 }, "Decaf Beans": { opening: 300 },
      "Whole Milk": { opening: 6000, deliveries: 6000 }, "Oat Milk": { opening: 2000, deliveries: 6000 } },
    [
      { name: "Cappuccino", size: "8 oz", quantity: 49 },
      { name: "Cappuccino", size: "12 oz", quantity: 29 },
      { name: "Caffè Latte", size: "12 oz", quantity: 34 },
      { name: "Flat White", size: "6 oz", quantity: 18 },
      { name: "Americano", size: "8 oz", quantity: 24 },
      { name: "Cortado", size: "4 oz", quantity: 11 },
      { name: "Oat Cappuccino", size: "8 oz", quantity: 17 },
    ],
    { "Espresso Beans": 11, "Decaf Beans": 0, "Whole Milk": -60, "Oat Milk": 30 },
    "Restocked oat milk and beans at open.",
  );

  seedClosing(
    daysAgo(1),
    { "Espresso Beans": { opening: 2900 }, "Decaf Beans": { opening: 290 },
      "Whole Milk": { opening: 8000 }, "Oat Milk": { opening: 4500 } },
    [
      { name: "Cappuccino", size: "8 oz", quantity: 38 },
      { name: "Cappuccino", size: "12 oz", quantity: 21 },
      { name: "Caffè Latte", size: "12 oz", quantity: 27 },
      { name: "Flat White", size: "6 oz", quantity: 14 },
      { name: "Americano", size: "8 oz", quantity: 23 },
      { name: "Oat Cappuccino", size: "8 oz", quantity: 15 },
      { name: "Decaf Americano", size: "8 oz", quantity: 3 },
    ],
    { "Espresso Beans": 7, "Decaf Beans": 0, "Whole Milk": 150, "Oat Milk": 0 },
    "Variance looks like one cappuccino that never hit the till — two comps for the roaster visit.",
  );

}

/** Replace all business data with the sample catalogue and three closings. */
export function seedDemoData() {
  resetDatabase();
  insertDemoData();
  return dataCounts();
}
