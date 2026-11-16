import express from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  dataCounts,
  db,
  getIngredients,
  getPackaging,
  getProducts,
  getClosingByDate,
  getClosingDetail,
  getSettings,
  closingsForDate,
  listClosings,
  previousClosingFor,
  reportForRange,
  resetDatabase,
  runDataMaintenance,
  saveClosing,
  seedDemoData,
  updateSettings,
} from "./db.js";
import { exportBackupCsv, importBackupCsv } from "./backup.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json({ limit: "25mb" }));

// Upgrade older databases without adding example business data to a new shop.
runDataMaintenance();

const fail = (res, status, message) => res.status(status).json({ error: message });
const asNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const nonNegative = (value, fallback = 0) => Math.max(0, asNumber(value, fallback));
const percentage = (value, fallback = 0) =>
  Math.min(100, Math.max(0, asNumber(value, fallback)));

/** Purchase details for one ingredient. */
function purchaseData(body, existing = {}) {
  return {
    pack_price: nonNegative(body?.pack_price, existing.pack_price ?? 0),
    pack_size: Math.max(0.0001, asNumber(body?.pack_size, existing.pack_size ?? 1)),
    waste_pct: percentage(body?.waste_pct, existing.waste_pct ?? 0),
  };
}

/** Yield, overheads, target and actual menu price for a beverage. */
function pricingData(body, existing = {}) {
  const rawPrice =
    body?.selling_price !== undefined ? body.selling_price : existing.selling_price;
  return {
    yield_qty: Math.max(0.01, asNumber(body?.yield_qty, existing.yield_qty ?? 1)),
    provision_pct: percentage(body?.provision_pct, existing.provision_pct ?? 20),
    target_food_cost_pct: Math.max(
      0.01,
      Math.min(100, asNumber(body?.target_food_cost_pct, existing.target_food_cost_pct ?? 33)),
    ),
    vat_pct: percentage(body?.vat_pct, existing.vat_pct ?? 12),
    selling_price:
      rawPrice === null || rawPrice === "" || !(Number(rawPrice) > 0)
        ? null
        : nonNegative(rawPrice, 0),
  };
}

/* --------------------------------------------------------------- settings */

app.get("/api/settings", (_req, res) => {
  res.json(getSettings());
});

app.put("/api/settings", (req, res) => {
  const currency = String(req.body?.currency ?? "").trim();
  if (!currency) return fail(res, 400, "Currency is required");
  if (currency.length > 8) return fail(res, 400, "Currency must be 8 characters or fewer");
  res.json(updateSettings({ currency }));
});

/* ------------------------------------------------------ backup / restore */

app.get("/api/backup.csv", (_req, res) => {
  const date = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="brew-ledger-backup-${date}.csv"`,
  );
  res.send(`\uFEFF${exportBackupCsv()}`);
});

app.post("/api/import", (req, res) => {
  const csv = req.body?.csv;
  if (typeof csv !== "string" || !csv.trim())
    return fail(res, 400, "Choose a Brew Ledger backup CSV to import");
  try {
    const counts = importBackupCsv(csv);
    res.json({ ok: true, counts });
  } catch (error) {
    return fail(res, 400, error instanceof Error ? error.message : "Could not import the backup");
  }
});

app.post("/api/demo", (_req, res) => {
  res.json({ ok: true, counts: seedDemoData() });
});

app.post("/api/reset", (_req, res) => {
  resetDatabase();
  res.json({ ok: true, counts: dataCounts() });
});

/* ------------------------------------------------------------ ingredients */

app.get("/api/ingredients", (_req, res) => {
  res.json(getIngredients());
});

app.post("/api/ingredients", (req, res) => {
  const name = String(req.body?.name || "").trim();
  const unit = String(req.body?.unit || "g");
  const category = String(req.body?.category || "Other").trim() || "Other";
  if (!name) return fail(res, 400, "Ingredient name is required");
  if (!["g", "ml", "pcs"].includes(unit))
    return fail(res, 400, "Unit must be g, ml or pcs");

  const duplicate = db
    .prepare("SELECT id FROM ingredients WHERE lower(name) = lower(?)")
    .get(name);
  if (duplicate) return fail(res, 409, "An ingredient with that name already exists");

  const { next } = db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM ingredients")
    .get();
  const purchase = purchaseData(req.body);
  const result = db
    .prepare(
      `INSERT INTO ingredients
        (name, unit, category, pack_price, pack_size, waste_pct, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      name,
      unit,
      category,
      purchase.pack_price,
      purchase.pack_size,
      purchase.waste_pct,
      next,
    );
  res
    .status(201)
    .json(db.prepare("SELECT * FROM ingredients WHERE id = ?").get(Number(result.lastInsertRowid)));
});

app.put("/api/ingredients/:id", (req, res) => {
  const id = asNumber(req.params.id);
  const existing = db.prepare("SELECT * FROM ingredients WHERE id = ?").get(id);
  if (!existing) return fail(res, 404, "Ingredient not found");

  const name = String(req.body?.name ?? existing.name).trim();
  const unit = String(req.body?.unit ?? existing.unit);
  const category = String(req.body?.category ?? existing.category).trim() || "Other";
  if (!name) return fail(res, 400, "Ingredient name is required");
  if (!["g", "ml", "pcs"].includes(unit))
    return fail(res, 400, "Unit must be g, ml or pcs");

  const purchase = purchaseData(req.body, existing);
  db.prepare(
    `UPDATE ingredients
        SET name = ?, unit = ?, category = ?,
            pack_price = ?, pack_size = ?, waste_pct = ?
      WHERE id = ?`,
  ).run(
    name,
    unit,
    category,
    purchase.pack_price,
    purchase.pack_size,
    purchase.waste_pct,
    id,
  );
  res.json(db.prepare("SELECT * FROM ingredients WHERE id = ?").get(id));
});

app.delete("/api/ingredients/:id", (req, res) => {
  const id = asNumber(req.params.id);
  const used = db
    .prepare("SELECT COUNT(*) AS n FROM recipe_items WHERE ingredient_id = ?")
    .get(id);
  if (used.n > 0)
    return fail(res, 409, "This ingredient is used in a recipe. Remove it there first.");
  db.prepare("DELETE FROM ingredients WHERE id = ?").run(id);
  res.json({ ok: true });
});

/* --------------------------------------------------------------- packaging */

app.get("/api/packaging", (_req, res) => {
  res.json(getPackaging());
});

app.post("/api/packaging", (req, res) => {
  const name = String(req.body?.name || "").trim();
  const unit = String(req.body?.unit || "pcs");
  if (!name) return fail(res, 400, "Packaging name is required");
  if (!["g", "ml", "pcs"].includes(unit))
    return fail(res, 400, "Unit must be g, ml or pcs");
  const duplicate = db
    .prepare("SELECT id FROM packaging WHERE lower(name) = lower(?)")
    .get(name);
  if (duplicate) return fail(res, 409, "A packaging material with that name already exists");
  const purchase = purchaseData(req.body);
  const sort = db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM packaging")
    .get();
  const result = db
    .prepare(
      `INSERT INTO packaging (name, unit, pack_price, pack_size, waste_pct, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(name, unit, purchase.pack_price, purchase.pack_size, purchase.waste_pct, sort.next);
  res
    .status(201)
    .json(db.prepare("SELECT * FROM packaging WHERE id = ?").get(Number(result.lastInsertRowid)));
});

app.put("/api/packaging/:id", (req, res) => {
  const id = asNumber(req.params.id);
  const existing = db.prepare("SELECT * FROM packaging WHERE id = ?").get(id);
  if (!existing) return fail(res, 404, "Packaging not found");
  const name = String(req.body?.name ?? existing.name).trim();
  const unit = String(req.body?.unit ?? existing.unit);
  if (!name) return fail(res, 400, "Packaging name is required");
  if (!["g", "ml", "pcs"].includes(unit))
    return fail(res, 400, "Unit must be g, ml or pcs");
  const purchase = purchaseData(req.body, existing);
  db.prepare(
    `UPDATE packaging
        SET name = ?, unit = ?, pack_price = ?, pack_size = ?, waste_pct = ?
      WHERE id = ?`,
  ).run(name, unit, purchase.pack_price, purchase.pack_size, purchase.waste_pct, id);
  res.json(db.prepare("SELECT * FROM packaging WHERE id = ?").get(id));
});

app.delete("/api/packaging/:id", (req, res) => {
  const id = asNumber(req.params.id);
  const used = db
    .prepare("SELECT COUNT(*) AS n FROM product_packaging WHERE packaging_id = ?")
    .get(id);
  if (used.n > 0)
    return fail(res, 409, "This packaging is used by a drink. Remove it there first.");
  db.prepare("DELETE FROM packaging WHERE id = ?").run(id);
  res.json({ ok: true });
});

/* --------------------------------------------------------------- products */

app.get("/api/products", (_req, res) => {
  res.json(getProducts());
});

function validateRecipe(recipe) {
  if (!Array.isArray(recipe)) return "Recipe must be a list of ingredients";
  for (const line of recipe) {
    const qty = Number(line.qty);
    if (!Number.isFinite(qty) || qty < 0) return "Recipe quantities must be positive numbers";
  }
  return null;
}

function validateLinkedLines(lines, label, idKey, knownIds) {
  if (!Array.isArray(lines)) return `${label} must be a list`;
  for (const line of lines) {
    const qty = Number(line.qty);
    if (!Number.isFinite(qty) || qty <= 0)
      return `${label} quantities must be greater than zero`;
  }
  if (new Set(lines.map((line) => Number(line[idKey]))).size !== lines.length)
    return `Each line can only appear once in ${label.toLowerCase()}`;
  for (const line of lines) {
    if (!knownIds.has(Number(line[idKey])))
      return `${label} reference an unknown item`;
  }
  return null;
}

function validateProductComponents(recipe, packaging) {
  const recipeError = validateRecipe(recipe);
  if (recipeError) return recipeError;

  const ingredientIds = new Set(getIngredients().map((i) => i.id));
  for (const line of recipe) {
    if (!ingredientIds.has(Number(line.ingredient_id)))
      return "Recipe references an unknown ingredient";
  }

  return validateLinkedLines(
    packaging,
    "Packaging",
    "packaging_id",
    new Set(getPackaging().map((p) => p.id)),
  );
}

function writeProductComponents(productId, recipe, packaging) {
  db.prepare("DELETE FROM recipe_items WHERE product_id = ?").run(productId);
  const insertRecipe = db.prepare(
    "INSERT INTO recipe_items (product_id, ingredient_id, qty) VALUES (?, ?, ?)",
  );
  for (const line of recipe) {
    insertRecipe.run(productId, Number(line.ingredient_id), Number(line.qty) || 0);
  }

  db.prepare("DELETE FROM product_packaging WHERE product_id = ?").run(productId);
  const insertPackaging = db.prepare(
    "INSERT INTO product_packaging (product_id, packaging_id, qty) VALUES (?, ?, ?)",
  );
  for (const line of packaging) {
    insertPackaging.run(productId, Number(line.packaging_id), Number(line.qty) || 0);
  }
}

app.post("/api/products", (req, res) => {
  const name = String(req.body?.name || "").trim();
  const category = String(req.body?.category || "Espresso").trim() || "Espresso";
  const sizeLabel = String(req.body?.size_label || "").trim();
  const recipe = req.body?.recipe ?? [];
  const packaging = req.body?.packaging ?? [];
  if (!name) return fail(res, 400, "Beverage name is required");
  const componentsError = validateProductComponents(recipe, packaging);
  if (componentsError) return fail(res, 400, componentsError);
  if (recipe.length === 0)
    return fail(res, 400, "Add at least one ingredient");

  const pricing = pricingData(req.body);
  db.exec("BEGIN");
  try {
    const result = db
      .prepare(
        `INSERT INTO products
          (name, category, size_label, yield_qty, packaging_cost,
           provision_pct, target_food_cost_pct, vat_pct, selling_price)
         VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      )
      .run(
        name,
        category,
        sizeLabel,
        pricing.yield_qty,
        pricing.provision_pct,
        pricing.target_food_cost_pct,
        pricing.vat_pct,
        pricing.selling_price,
      );
    const productId = Number(result.lastInsertRowid);
    writeProductComponents(productId, recipe, packaging);
    db.exec("COMMIT");
    res.status(201).json(getProducts().find((p) => p.id === productId));
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
});

app.put("/api/products/:id", (req, res) => {
  const id = asNumber(req.params.id);
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  if (!existing) return fail(res, 404, "Beverage not found");

  const name = String(req.body?.name ?? existing.name).trim();
  const category = String(req.body?.category ?? existing.category).trim() || "Espresso";
  const sizeLabel = String(req.body?.size_label ?? existing.size_label).trim();
  const recipe =
    req.body?.recipe !== undefined
      ? req.body.recipe
      : db
          .prepare("SELECT ingredient_id, qty FROM recipe_items WHERE product_id = ?")
          .all(id);
  const packaging =
    req.body?.packaging !== undefined
      ? req.body.packaging
      : db
          .prepare("SELECT packaging_id, qty FROM product_packaging WHERE product_id = ?")
          .all(id);

  if (!name) return fail(res, 400, "Beverage name is required");
  const componentsError = validateProductComponents(recipe, packaging);
  if (componentsError) return fail(res, 400, componentsError);
  if (recipe.length === 0)
    return fail(res, 400, "Add at least one ingredient");

  const pricing = pricingData(req.body, existing);
  db.exec("BEGIN");
  try {
    db.prepare(
      `UPDATE products
          SET name = ?, category = ?, size_label = ?, yield_qty = ?,
              packaging_cost = 0, provision_pct = ?, target_food_cost_pct = ?,
              vat_pct = ?, selling_price = ?
        WHERE id = ?`,
    ).run(
      name,
      category,
      sizeLabel,
      pricing.yield_qty,
      pricing.provision_pct,
      pricing.target_food_cost_pct,
      pricing.vat_pct,
      pricing.selling_price,
      id,
    );
    writeProductComponents(id, recipe, packaging);
    db.exec("COMMIT");
    res.json(getProducts().find((p) => p.id === id));
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
});

app.delete("/api/products/:id", (req, res) => {
  const id = asNumber(req.params.id);
  db.prepare("DELETE FROM products WHERE id = ?").run(id);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------- days */

const SHIFTS = ["am", "mid", "pm", "gy"];
const shiftValue = (value, fallback = "pm") =>
  SHIFTS.includes(String(value)) ? String(value) : fallback;

app.get("/api/day", (req, res) => {
  const date = String(req.query.date || new Date().toISOString().slice(0, 10));
  const shift = shiftValue(req.query.shift);
  const ingredients = getIngredients();
  const products = getProducts();
  const closing = getClosingByDate(date, shift);
  const detail = closing ? getClosingDetail(closing.id) : null;
  const previous = detail ? null : previousClosingFor(date, shift);

  const counts = ingredients.map((ingredient) => {
    const saved = detail?.lines.find((l) => l.ingredient_id === ingredient.id);
    const carried = previous?.lines.find((l) => l.ingredient_id === ingredient.id);
    return {
      ingredient_id: ingredient.id,
      opening: saved?.opening ?? carried?.closing ?? 0,
      deliveries: saved?.deliveries ?? 0,
      waste: saved?.waste ?? 0,
      closing: saved?.closing ?? 0,
    };
  });

  const sales = products.map((product) => ({
    product_id: product.id,
    quantity:
      detail?.sales.find((s) => s.product_id === product.id)?.quantity ?? 0,
  }));

  res.json({
    date,
    shift,
    closing: detail,
    carried_from: previous?.date ?? null,
    carried_from_shift: previous?.shift ?? null,
    shifts: closingsForDate(date).map((row) => ({
      shift: row.shift,
      id: row.id,
      prepared_by: row.prepared_by,
    })),
    counts,
    sales,
  });
});

app.post("/api/closings", (req, res) => {
  const date = String(req.body?.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(res, 400, "A valid date is required");
  const shift = String(req.body?.shift || "pm");
  if (!SHIFTS.includes(shift)) return fail(res, 400, "Shift must be am, mid, pm or gy");

  const counts = Array.isArray(req.body?.counts) ? req.body.counts : [];
  const sales = Array.isArray(req.body?.sales) ? req.body.sales : [];

  const knownIngredients = new Set(getIngredients().map((i) => i.id));
  for (const count of counts) {
    if (!knownIngredients.has(Number(count.ingredient_id)))
      return fail(res, 400, "Counts reference an unknown ingredient");
  }
  const knownProducts = new Set(getProducts().map((p) => p.id));
  for (const sale of sales) {
    if (!knownProducts.has(Number(sale.product_id)))
      return fail(res, 400, "Sales reference an unknown beverage");
    if (Number(sale.quantity) < 0)
      return fail(res, 400, "Units sold cannot be negative");
  }

  const closing = saveClosing({
    date,
    shift,
    prepared_by: String(req.body?.prepared_by || "").trim(),
    notes: String(req.body?.notes || ""),
    counts,
    sales,
  });
  res.status(201).json(closing);
});

app.get("/api/closings", (_req, res) => {
  res.json(listClosings());
});

app.get("/api/closings/:id", (req, res) => {
  const detail = getClosingDetail(asNumber(req.params.id));
  if (!detail) return fail(res, 404, "Closing not found");
  res.json(detail);
});

app.delete("/api/closings/:id", (req, res) => {
  db.prepare("DELETE FROM closings WHERE id = ?").run(asNumber(req.params.id));
  res.json({ ok: true });
});

/* ----------------------------------------------------------------- report */

app.get("/api/report", (req, res) => {
  const from = String(req.query.from || "");
  const to = String(req.query.to || "");
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!validDate(from) || !validDate(to))
    return fail(res, 400, "Report requires valid from and to dates");
  if (from > to) return fail(res, 400, "The report start date must be before its end date");
  res.json(reportForRange(from, to));
});

/* -------------------------------------------------------------- dashboard */

app.get("/api/overview", (_req, res) => {
  const closings = listClosings();
  const latest = closings[0] ? getClosingDetail(closings[0].id) : null;

  res.json({
    closings: closings.slice(0, 8),
    latest,
    counts: {
      ingredients: getIngredients().length,
      beverages: getProducts().length,
      closings: closings.length,
    },
  });
});

/* ------------------------------------------------------- static + errors */

const dist = join(__dirname, "..", "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(join(dist, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.json({ ok: true, hint: "Run `npm run dev` for the UI, or `npm run build` first." });
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Something went wrong on the server" });
});

app.listen(PORT, () => {
  console.log(`brew-variance API listening on http://localhost:${PORT}`);
});
