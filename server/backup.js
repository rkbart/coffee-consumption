import {
  clearBusinessData,
  dataCounts,
  db,
  getSettings,
  SHIFT_IDS,
} from "./db.js";

const BACKUP_VERSION = "1";

const COLUMNS = [
  "record_type",
  "key",
  "value",
  "name",
  "category",
  "unit",
  "pack_price",
  "pack_size",
  "waste_pct",
  "sort_order",
  "product_name",
  "size_label",
  "yield_qty",
  "provision_pct",
  "target_food_cost_pct",
  "vat_pct",
  "selling_price",
  "ingredient_name",
  "packaging_name",
  "date",
  "shift",
  "prepared_by",
  "notes",
  "opening",
  "deliveries",
  "waste",
  "closing",
  "actual_usage",
  "theoretical_usage",
  "variance",
  "quantity",
  "created_at",
];

const KNOWN_RECORD_TYPES = new Set([
  "meta",
  "setting",
  "ingredient",
  "packaging",
  "product",
  "recipe_item",
  "product_packaging",
  "closing",
  "closing_line",
  "closing_sale",
]);

const text = (value) => String(value ?? "").trim();

const number = (value, fallback = 0) => {
  const parsed = Number(text(value));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const csvCell = (value) => {
  const string = String(value ?? "");
  return /[",\r\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
};

const csvRow = (recordType, values = {}) =>
  COLUMNS.map((column) =>
    csvCell(column === "record_type" ? recordType : values[column] ?? ""),
  ).join(",");

const productKey = (name, size) => `${text(name)}\u0000${text(size)}`;
const closingKey = (date, shift) => `${text(date)}\u0000${text(shift)}`;

/** One self-contained CSV containing everything needed to restore the ledger. */
export function exportBackupCsv() {
  const lines = [COLUMNS.join(",")];
  lines.push(
    csvRow("meta", { key: "schema_version", value: BACKUP_VERSION }),
  );
  lines.push(
    csvRow("meta", { key: "exported_at", value: new Date().toISOString() }),
  );

  for (const [key, value] of Object.entries(getSettings())) {
    lines.push(csvRow("setting", { key, value }));
  }

  const ingredients = db
    .prepare("SELECT * FROM ingredients ORDER BY sort_order, name, id")
    .all();
  for (const ingredient of ingredients) {
    lines.push(
      csvRow("ingredient", {
        name: ingredient.name,
        category: ingredient.category,
        unit: ingredient.unit,
        pack_price: ingredient.pack_price,
        pack_size: ingredient.pack_size,
        waste_pct: ingredient.waste_pct,
        sort_order: ingredient.sort_order,
      }),
    );
  }

  const packaging = db
    .prepare("SELECT * FROM packaging ORDER BY sort_order, name, id")
    .all();
  for (const material of packaging) {
    lines.push(
      csvRow("packaging", {
        name: material.name,
        unit: material.unit,
        pack_price: material.pack_price,
        pack_size: material.pack_size,
        waste_pct: material.waste_pct,
        sort_order: material.sort_order,
      }),
    );
  }

  const products = db
    .prepare("SELECT * FROM products ORDER BY category, name, size_label, id")
    .all();
  for (const product of products) {
    lines.push(
      csvRow("product", {
        name: product.name,
        category: product.category,
        size_label: product.size_label,
        yield_qty: product.yield_qty,
        provision_pct: product.provision_pct,
        target_food_cost_pct: product.target_food_cost_pct,
        vat_pct: product.vat_pct,
        selling_price: product.selling_price ?? "",
        created_at: product.created_at,
      }),
    );
  }

  const recipeItems = db
    .prepare(
      `SELECT p.name AS product_name, p.size_label, i.name AS ingredient_name,
              ri.qty
         FROM recipe_items ri
         JOIN products p ON p.id = ri.product_id
         JOIN ingredients i ON i.id = ri.ingredient_id
        ORDER BY p.category, p.name, p.size_label, i.sort_order, i.name`,
    )
    .all();
  for (const item of recipeItems) {
    lines.push(
      csvRow("recipe_item", {
        product_name: item.product_name,
        size_label: item.size_label,
        ingredient_name: item.ingredient_name,
        quantity: item.qty,
      }),
    );
  }

  const packagingItems = db
    .prepare(
      `SELECT p.name AS product_name, p.size_label, m.name AS packaging_name,
              pp.qty
         FROM product_packaging pp
         JOIN products p ON p.id = pp.product_id
         JOIN packaging m ON m.id = pp.packaging_id
        ORDER BY p.category, p.name, p.size_label, m.sort_order, m.name`,
    )
    .all();
  for (const item of packagingItems) {
    lines.push(
      csvRow("product_packaging", {
        product_name: item.product_name,
        size_label: item.size_label,
        packaging_name: item.packaging_name,
        quantity: item.qty,
      }),
    );
  }

  const closings = db
    .prepare("SELECT * FROM closings ORDER BY date, id")
    .all();
  for (const closing of closings) {
    lines.push(
      csvRow("closing", {
        date: closing.date,
        shift: closing.shift,
        prepared_by: closing.prepared_by,
        notes: closing.notes,
        created_at: closing.created_at,
      }),
    );
  }

  const closingLines = db
    .prepare(
      `SELECT c.date, c.shift, l.*
         FROM closing_lines l
         JOIN closings c ON c.id = l.closing_id
        ORDER BY c.date, c.id, l.id`,
    )
    .all();
  for (const line of closingLines) {
    lines.push(
      csvRow("closing_line", {
        date: line.date,
        shift: line.shift,
        ingredient_name: line.ingredient_name,
        unit: line.unit,
        opening: line.opening,
        deliveries: line.deliveries,
        waste: line.waste,
        closing: line.closing,
        actual_usage: line.actual_usage,
        theoretical_usage: line.theoretical_usage,
        variance: line.variance,
      }),
    );
  }

  const closingSales = db
    .prepare(
      `SELECT c.date, c.shift, s.*
         FROM closing_sales s
         JOIN closings c ON c.id = s.closing_id
        ORDER BY c.date, c.id, s.id`,
    )
    .all();
  for (const sale of closingSales) {
    lines.push(
      csvRow("closing_sale", {
        date: sale.date,
        shift: sale.shift,
        product_name: sale.product_name,
        size_label: sale.size_label,
        quantity: sale.quantity,
      }),
    );
  }

  return `${lines.join("\r\n")}\r\n`;
}

/* -------------------------------------------------------------- CSV reader */

export function parseCsv(source) {
  const input = String(source ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

const requireValue = (condition, message) => {
  if (!condition) throw new Error(message);
};

/**
 * Validate and replace all business data from a backup CSV. Everything happens
 * in one transaction, so a bad row leaves the existing database untouched.
 */
export function importBackupCsv(source) {
  const rows = parseCsv(source);
  requireValue(rows.length > 1, "The CSV file is empty.");

  const header = rows[0].map((cell) => text(cell).toLowerCase());
  const columnIndex = new Map();
  header.forEach((name, index) => {
    if (!name) return;
    requireValue(!columnIndex.has(name), `The CSV has two “${name}” columns.`);
    columnIndex.set(name, index);
  });
  requireValue(columnIndex.has("record_type"), "This CSV has no record_type column.");

  const read = (cells, name) =>
    columnIndex.has(name) ? text(cells[columnIndex.get(name)]) : "";

  const records = rows
    .slice(1)
    .filter((cells) => cells.some((cell) => text(cell) !== ""))
    .map((cells) => {
      const record = {};
      for (const name of columnIndex.keys()) {
        record[name] = read(cells, name);
      }
      return record;
    });

  for (const record of records) {
    requireValue(
      KNOWN_RECORD_TYPES.has(record.record_type),
      `Unknown record type “${record.record_type}”.`,
    );
  }

  const meta = records.filter((record) => record.record_type === "meta");
  requireValue(
    meta.some(
      (record) => record.key === "schema_version" && record.value === BACKUP_VERSION,
    ),
    "This does not look like a Brew Ledger backup CSV.",
  );

  const ingredients = records
    .filter((record) => record.record_type === "ingredient")
    .map((record) => ({
      name: text(record.name),
      category: text(record.category) || "Other",
      unit: text(record.unit) || "g",
      pack_price: Math.max(0, number(record.pack_price)),
      pack_size: Math.max(0.0001, number(record.pack_size, 1)),
      waste_pct: Math.min(100, Math.max(0, number(record.waste_pct))),
      sort_order: Math.trunc(number(record.sort_order)),
    }));
  const ingredientNames = new Set();
  for (const ingredient of ingredients) {
    requireValue(ingredient.name, "An ingredient row has no name.");
    requireValue(
      ["g", "ml", "pcs"].includes(ingredient.unit),
      `Ingredient “${ingredient.name}” has an invalid unit.`,
    );
    requireValue(
      !ingredientNames.has(ingredient.name.toLowerCase()),
      `Ingredient “${ingredient.name}” appears twice.`,
    );
    ingredientNames.add(ingredient.name.toLowerCase());
  }

  const packaging = records
    .filter((record) => record.record_type === "packaging")
    .map((record) => ({
      name: text(record.name),
      unit: text(record.unit) || "pcs",
      pack_price: Math.max(0, number(record.pack_price)),
      pack_size: Math.max(0.0001, number(record.pack_size, 1)),
      waste_pct: Math.min(100, Math.max(0, number(record.waste_pct))),
      sort_order: Math.trunc(number(record.sort_order)),
    }));
  const packagingNames = new Set();
  for (const material of packaging) {
    requireValue(material.name, "A packaging row has no name.");
    requireValue(
      ["g", "ml", "pcs"].includes(material.unit),
      `Packaging “${material.name}” has an invalid unit.`,
    );
    requireValue(
      !packagingNames.has(material.name.toLowerCase()),
      `Packaging “${material.name}” appears twice.`,
    );
    packagingNames.add(material.name.toLowerCase());
  }

  const products = records
    .filter((record) => record.record_type === "product")
    .map((record) => ({
      name: text(record.name),
      category: text(record.category) || "Coffee",
      size_label: text(record.size_label),
      yield_qty: Math.max(0.01, number(record.yield_qty, 1)),
      provision_pct: Math.min(100, Math.max(0, number(record.provision_pct, 20))),
      target_food_cost_pct: Math.min(
        100,
        Math.max(0.01, number(record.target_food_cost_pct, 33)),
      ),
      vat_pct: Math.min(100, Math.max(0, number(record.vat_pct, 12))),
      selling_price: record.selling_price === "" ? null : Math.max(0, number(record.selling_price)),
      created_at: text(record.created_at),
    }));
  const productKeys = new Set();
  for (const product of products) {
    requireValue(product.name, "A product row has no name.");
    const key = productKey(product.name, product.size_label);
    requireValue(!productKeys.has(key), `Beverage “${product.name}” appears twice with the same size.`);
    productKeys.add(key);
  }

  const recipeItems = records
    .filter((record) => record.record_type === "recipe_item")
    .map((record) => ({
      productKey: productKey(record.product_name, record.size_label),
      ingredientName: text(record.ingredient_name),
      qty: number(record.quantity),
    }));
  const recipesSeen = new Set();
  for (const item of recipeItems) {
    requireValue(
      productKeys.has(item.productKey),
      `A recipe references a beverage that is not in the file: ${text(item.productKey.split("\u0000")[0])}.`,
    );
    requireValue(
      ingredientNames.has(item.ingredientName.toLowerCase()),
      `A recipe references an ingredient that is not in the file: ${item.ingredientName || "(blank)"}.`,
    );
    requireValue(item.qty > 0, `A recipe for “${item.ingredientName}” has no quantity.`);
    const key = `${item.productKey}\u0000${item.ingredientName.toLowerCase()}`;
    requireValue(!recipesSeen.has(key), `A beverage has “${item.ingredientName}” listed twice.`);
    recipesSeen.add(key);
  }

  const productPackaging = records
    .filter((record) => record.record_type === "product_packaging")
    .map((record) => ({
      productKey: productKey(record.product_name, record.size_label),
      packagingName: text(record.packaging_name),
      qty: number(record.quantity),
    }));
  const packagingSeen = new Set();
  for (const item of productPackaging) {
    requireValue(
      productKeys.has(item.productKey),
      `Packaging references a beverage that is not in the file: ${text(item.productKey.split("\u0000")[0])}.`,
    );
    requireValue(
      packagingNames.has(item.packagingName.toLowerCase()),
      `A beverage references packaging that is not in the file: ${item.packagingName || "(blank)"}.`,
    );
    requireValue(item.qty > 0, `Packaging “${item.packagingName}” has no quantity.`);
    const key = `${item.productKey}\u0000${item.packagingName.toLowerCase()}`;
    requireValue(!packagingSeen.has(key), `A beverage has “${item.packagingName}” listed twice.`);
    packagingSeen.add(key);
  }

  const closings = records
    .filter((record) => record.record_type === "closing")
    .map((record) => ({
      date: text(record.date),
      shift: text(record.shift).toLowerCase(),
      prepared_by: text(record.prepared_by),
      notes: String(record.notes ?? "").trim(),
      created_at: text(record.created_at),
    }));
  const closingKeys = new Set();
  for (const closing of closings) {
    requireValue(
      /^\d{4}-\d{2}-\d{2}$/.test(closing.date),
      `A closing has an invalid date: ${closing.date || "(blank)"}.`,
    );
    requireValue(
      SHIFT_IDS.includes(closing.shift),
      `A closing has an invalid shift: ${closing.shift || "(blank)"}.`,
    );
    const key = closingKey(closing.date, closing.shift);
    requireValue(!closingKeys.has(key), `Closing ${closing.date} ${closing.shift} appears twice.`);
    closingKeys.add(key);
  }

  const closingLines = records
    .filter((record) => record.record_type === "closing_line")
    .map((record) => ({
      closingKey: closingKey(record.date, record.shift.toLowerCase()),
      ingredient_name: text(record.ingredient_name) || "Unknown ingredient",
      unit: text(record.unit) || "g",
      opening: number(record.opening),
      deliveries: number(record.deliveries),
      waste: number(record.waste),
      closing: number(record.closing),
      actual_usage: number(record.actual_usage),
      theoretical_usage: number(record.theoretical_usage),
      variance: number(record.variance),
    }));
  for (const line of closingLines) {
    requireValue(
      closingKeys.has(line.closingKey),
      `A closing line references a missing closing: ${line.closingKey.replace("\u0000", " ")}.`,
    );
  }

  const closingSales = records
    .filter((record) => record.record_type === "closing_sale")
    .map((record) => ({
      closingKey: closingKey(record.date, record.shift.toLowerCase()),
      productKey: productKey(record.product_name, record.size_label),
      product_name: text(record.product_name),
      size_label: text(record.size_label),
      quantity: Math.max(0, Math.trunc(number(record.quantity))),
    }));
  for (const sale of closingSales) {
    requireValue(
      closingKeys.has(sale.closingKey),
      `A sale references a missing closing: ${sale.closingKey.replace("\u0000", " ")}.`,
    );
    requireValue(sale.product_name, "A closing sale row has no beverage name.");
  }

  const settings = records
    .filter((record) => record.record_type === "setting")
    .map((record) => ({ key: text(record.key), value: text(record.value) }));
  const currencyRecord = settings.find((record) => record.key === "currency");
  const currency = currencyRecord?.value || getSettings().currency;
  requireValue(
    currency.length > 0 && currency.length <= 8,
    "The currency setting must be between 1 and 8 characters.",
  );

  db.exec("BEGIN");
  try {
    clearBusinessData();

    db.prepare(
      `INSERT INTO settings (key, value) VALUES ('currency', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run(currency);

    const ingredientIds = new Map();
    const insertIngredient = db.prepare(
      `INSERT INTO ingredients
        (name, unit, category, pack_price, pack_size, waste_pct, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const ingredient of ingredients) {
      const result = insertIngredient.run(
        ingredient.name,
        ingredient.unit,
        ingredient.category,
        ingredient.pack_price,
        ingredient.pack_size,
        ingredient.waste_pct,
        ingredient.sort_order,
      );
      ingredientIds.set(ingredient.name.toLowerCase(), Number(result.lastInsertRowid));
    }

    const packagingIds = new Map();
    const insertPackaging = db.prepare(
      `INSERT INTO packaging
        (name, unit, pack_price, pack_size, waste_pct, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const material of packaging) {
      const result = insertPackaging.run(
        material.name,
        material.unit,
        material.pack_price,
        material.pack_size,
        material.waste_pct,
        material.sort_order,
      );
      packagingIds.set(material.name.toLowerCase(), Number(result.lastInsertRowid));
    }

    const productIds = new Map();
    const insertProduct = db.prepare(
      `INSERT INTO products
        (name, category, size_label, yield_qty, packaging_cost,
         provision_pct, target_food_cost_pct, vat_pct, selling_price, created_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, COALESCE(NULLIF(?, ''), datetime('now')))`,
    );
    for (const product of products) {
      const result = insertProduct.run(
        product.name,
        product.category,
        product.size_label,
        product.yield_qty,
        product.provision_pct,
        product.target_food_cost_pct,
        product.vat_pct,
        product.selling_price,
        product.created_at,
      );
      productIds.set(productKey(product.name, product.size_label), Number(result.lastInsertRowid));
    }

    const insertRecipe = db.prepare(
      "INSERT INTO recipe_items (product_id, ingredient_id, qty) VALUES (?, ?, ?)",
    );
    for (const item of recipeItems) {
      insertRecipe.run(
        productIds.get(item.productKey),
        ingredientIds.get(item.ingredientName.toLowerCase()),
        item.qty,
      );
    }

    const insertProductPackaging = db.prepare(
      "INSERT INTO product_packaging (product_id, packaging_id, qty) VALUES (?, ?, ?)",
    );
    for (const item of productPackaging) {
      insertProductPackaging.run(
        productIds.get(item.productKey),
        packagingIds.get(item.packagingName.toLowerCase()),
        item.qty,
      );
    }

    const closingIds = new Map();
    const insertClosing = db.prepare(
      `INSERT INTO closings (date, shift, prepared_by, notes, created_at)
       VALUES (?, ?, ?, ?, COALESCE(NULLIF(?, ''), datetime('now')))`,
    );
    for (const closing of closings) {
      const result = insertClosing.run(
        closing.date,
        closing.shift,
        closing.prepared_by,
        closing.notes,
        closing.created_at,
      );
      closingIds.set(
        closingKey(closing.date, closing.shift),
        Number(result.lastInsertRowid),
      );
    }

    const insertClosingLine = db.prepare(
      `INSERT INTO closing_lines
        (closing_id, ingredient_id, ingredient_name, unit, opening, deliveries,
         waste, closing, actual_usage, theoretical_usage, variance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const line of closingLines) {
      insertClosingLine.run(
        closingIds.get(line.closingKey),
        ingredientIds.get(line.ingredient_name.toLowerCase()) ?? 0,
        line.ingredient_name,
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

    const insertClosingSale = db.prepare(
      `INSERT INTO closing_sales
        (closing_id, product_id, product_name, size_label, quantity)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const sale of closingSales) {
      if (sale.quantity <= 0) continue;
      insertClosingSale.run(
        closingIds.get(sale.closingKey),
        productIds.get(sale.productKey) ?? null,
        sale.product_name,
        sale.size_label,
        sale.quantity,
      );
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return dataCounts();
}
