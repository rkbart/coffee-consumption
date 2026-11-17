// Initial schema. Add new migrations here (import + array entry) whenever the
// schema changes — never reorder or remove existing entries; applied migrations
// are tracked by id in the `_migrations` table.

export const migrations: { id: string; sql: string }[] = [
  {
    id: '0000_initial',
    sql: `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS ingredients (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  unit        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'Other',
  pack_price  REAL NOT NULL DEFAULT 0,
  pack_size   REAL NOT NULL DEFAULT 1,
  waste_pct   REAL NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS packaging (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  unit        TEXT NOT NULL DEFAULT 'pcs',
  pack_price  REAL NOT NULL DEFAULT 0,
  pack_size   REAL NOT NULL DEFAULT 1,
  qty_needed  REAL NOT NULL DEFAULT 1,
  waste_pct   REAL NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

--> statement-breakpoint

ALTER TABLE packaging ADD COLUMN description TEXT NOT NULL DEFAULT '';

--> statement-breakpoint

ALTER TABLE packaging ADD COLUMN qty_needed REAL NOT NULL DEFAULT 1;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS products (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  name                 TEXT NOT NULL,
  category             TEXT NOT NULL DEFAULT 'Coffee',
  size_label           TEXT NOT NULL DEFAULT '',
  yield_qty            REAL NOT NULL DEFAULT 1,
  packaging_cost       REAL NOT NULL DEFAULT 0,
  provision_pct        REAL NOT NULL DEFAULT 20,
  target_food_cost_pct REAL NOT NULL DEFAULT 33,
  vat_pct              REAL NOT NULL DEFAULT 12,
  selling_price        REAL,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS recipe_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  qty           REAL NOT NULL DEFAULT 0
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_recipe_product ON recipe_items(product_id);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS product_packaging (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  packaging_id INTEGER NOT NULL REFERENCES packaging(id) ON DELETE RESTRICT,
  qty          REAL NOT NULL DEFAULT 1
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_product_packaging ON product_packaging(product_id);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS closings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,
  shift       TEXT NOT NULL DEFAULT 'pm',
  prepared_by TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (date, shift)
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_closings_date ON closings(date);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS closing_lines (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  closing_id       INTEGER NOT NULL REFERENCES closings(id) ON DELETE CASCADE,
  ingredient_id    INTEGER NOT NULL,
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

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_closing_lines_closing ON closing_lines(closing_id);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS closing_sales (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  closing_id    INTEGER NOT NULL REFERENCES closings(id) ON DELETE CASCADE,
  product_id    INTEGER,
  product_name  TEXT NOT NULL,
  size_label    TEXT NOT NULL DEFAULT '',
  quantity      INTEGER NOT NULL DEFAULT 0
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_closing_sales_closing ON closing_sales(closing_id);
`,
  },
  {
    id: '0001_packaging_sets',
    sql: `
CREATE TABLE IF NOT EXISTS packaging_components (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  packaging_id INTEGER NOT NULL REFERENCES packaging(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  unit         TEXT NOT NULL DEFAULT 'pcs',
  pack_price   REAL NOT NULL DEFAULT 0,
  pack_size    REAL NOT NULL DEFAULT 1,
  qty_needed   REAL NOT NULL DEFAULT 1,
  waste_pct    REAL NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_packaging_components_packaging
  ON packaging_components(packaging_id);

--> statement-breakpoint

INSERT INTO packaging_components (
  packaging_id, name, description, unit, pack_price, pack_size, qty_needed,
  waste_pct, sort_order
)
SELECT id, name, description, unit, pack_price, pack_size, qty_needed,
       waste_pct, sort_order
FROM packaging;
`,
  },
  {
    id: '0002_packaging_set_name',
    sql: `
CREATE TABLE packaging_sets (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  packaging_name TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  sort_order    INTEGER NOT NULL DEFAULT 0
);

--> statement-breakpoint

INSERT INTO packaging_sets (id, packaging_name, description, sort_order)
SELECT id, name, description, sort_order FROM packaging;

--> statement-breakpoint

CREATE TABLE packaging_components_v2 (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  packaging_id INTEGER NOT NULL REFERENCES packaging_sets(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  unit         TEXT NOT NULL DEFAULT 'pcs',
  pack_price   REAL NOT NULL DEFAULT 0,
  pack_size    REAL NOT NULL DEFAULT 1,
  qty_needed   REAL NOT NULL DEFAULT 1,
  waste_pct    REAL NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

--> statement-breakpoint

INSERT INTO packaging_components_v2
SELECT id, packaging_id, name, description, unit, pack_price, pack_size,
       qty_needed, waste_pct, sort_order
FROM packaging_components;

--> statement-breakpoint

CREATE TABLE product_packaging_v2 (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  packaging_id INTEGER NOT NULL REFERENCES packaging_sets(id) ON DELETE CASCADE,
  qty          REAL NOT NULL DEFAULT 1
);

--> statement-breakpoint

INSERT INTO product_packaging_v2 SELECT id, product_id, packaging_id, qty FROM product_packaging;

--> statement-breakpoint

DROP TABLE packaging_components;

--> statement-breakpoint

DROP TABLE product_packaging;

--> statement-breakpoint

DROP TABLE packaging;

--> statement-breakpoint

ALTER TABLE packaging_components_v2 RENAME TO packaging_components;

--> statement-breakpoint

ALTER TABLE product_packaging_v2 RENAME TO product_packaging;

--> statement-breakpoint

CREATE INDEX packaging_components_packaging_idx ON packaging_components(packaging_id);

--> statement-breakpoint

CREATE INDEX product_packaging_product_idx ON product_packaging(product_id);
`,
  },
];
