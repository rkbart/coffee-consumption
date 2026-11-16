# Brew Ledger

A small, self-hosted inventory ledger for coffee shops and restaurants. Define what
goes into each drink, count the shelf at close, and see the gap between what the
recipes say should have been used and what actually disappeared.

The idea comes from a paper/Excel daily dairy sheet: opening stock, deliveries,
waste, and closing stock per ingredient, reconciled against POS sales and recipes.

## The math

For every ingredient on every closing:

```
theoretical usage = Σ ((batch recipe quantity ÷ yield) × units sold)
actual usage      = opening + deliveries − waste − closing
variance          = actual − theoretical
```

Example — one 8 oz cappuccino at 7 g beans / 150 ml milk:

| | Beans | Milk |
|---|---|---|
| Opening | 250 g | 1,000 ml |
| Closing | 236 g | 700 ml |
| Actual usage | 14 g | 300 ml |
| Theoretical (1 sold) | 7 g | 150 ml |
| **Variance** | **+7 g** | **+150 ml** |

A positive variance is stock that left the shelf without a recorded sale (comps,
spills, over-pouring, unrecorded drinks). A negative variance is usage below the
recipe standard (over-counted closing, missed sale, tighter pours). Anything within
2% of theoretical is treated as on target.

## Recipe costing

The recipe cards follow the Perfect Food Cost sheet:

```
net recovery   = pack size × (1 − waste %)
unit cost      = pack price ÷ net recovery
food cost      = Σ (unit cost × recipe quantity)
portion cost   = food cost ÷ yield
standard cost  = portion cost + provision % + itemised packaging
suggested price (ex VAT)  = standard cost ÷ target food cost %
suggested price (inc VAT) = suggested price × (1 + VAT %)
```

Pack prices live on the ingredient, so changing a supplier price updates every
beverage that uses it. Menu prices are entered including VAT; the card compares
the standard cost against the VAT-exclusive price to show the food cost actually
achieved and the cash margin left per cup.

### Bases and the costing library

Made-in-house bases, such as a milk tea base, live in the **costing library** as
ingredients grouped under `Base`. Enter the cost of one batch as the pack price
and the batch yield as the pack size; the library then calculates a cost per ml
or gram. Recipes select the base directly, so there is no nested preparation
layer to maintain. For example, a 3,000 ml base costing ₱36 is ₱0.012 per ml,
and a drink using 200 ml adds ₱2.40 to its food cost.

Packaging is a separate catalog of materials (cups, lids, straws, bags) with a
pack price and pack size. Each drink selects the materials it uses and how many;
the packaging block and subtotal sit separately on the costing card.

## Running it

Requires Node 22+ (the API uses the built-in `node:sqlite` module, so there are no
native dependencies to compile).

```bash
npm install
npm run dev        # API on :4000, Vite UI on :5173
```

Open http://localhost:5173.

For a single production process:

```bash
npm run build
npm start          # serves the built UI and API from :4000
```

The database lives at `data/brew.db` and is created automatically on first boot.
A new shop starts with an empty database. Set `BREW_DB_PATH` to put it elsewhere.

## Data, backups and moving machines

Open **Settings** to choose the currency symbol, export a CSV backup, restore one,
load the optional demo café, or reset all business data. New databases stay empty
until the shop adds its own ingredients and menu; the demo is never inserted
automatically.

The backup CSV contains the costing library, packaging, beverages, recipe links,
every shift closing with its snapshot lines and sales, and the currency setting.
Import replaces the current business data in one transaction, so an invalid file
leaves the existing database untouched. The file is excluded from Git along with
the SQLite database, so each machine or deployment still needs its own backup or
persistent database storage.

Reset keeps the currency setting but permanently removes the catalogue and closing
history. Export first if the data may be needed again.

## Pages

- **Overview** — latest shift closing, usage totals, variance table, recent closings.
- **Recipes** — a cost sheet per beverage: ingredients and bases plus a separate
  packaging block, each with its own cost and subtotal, then the suggested selling
  price with VAT and the food cost actually achieved at your menu price. Search,
  menu-group filtering and pagination keep a growing menu manageable.
- **Costing library** — every ingredient, made-in-house base and packaging material
  in one searchable, paginated page. Purchase data is shared, so one price change
  re-costs every drink that uses it.
- **Daily count** — the closing workflow with AM, MID, PM and GY shift tabs, a
  prepared-by name, opening (carried from the previous shift), deliveries, waste,
  closing, units sold with debounced search, menu-group filtering and pagination,
  live theoretical vs actual comparison and shift notes. Each shift saves its own
  immutable snapshot.
- **Ending report** — aggregates saved closings over today, a week, month, year,
  year-to-date, last 30 days or a custom range. Shows opening and ending stock, deliveries, waste,
  actual vs theoretical usage, variance, the preparer for every shift, sales and shift
  notes. The date range lives in
  the URL, so the report can be shared; a print stylesheet produces a clean landscape
  handout for the owner or manager.
- **History** — immutable snapshots of each saved closing, searchable by date or note.
- **Settings** — display currency, CSV backup and restore, optional demo data, and a
  confirmation-protected reset danger zone.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/overview` | Dashboard payload |
| GET/PUT | `/api/settings` | Read / update shop settings such as currency |
| GET | `/api/backup.csv` | Download all business data as a CSV backup |
| POST | `/api/import` | Validate and restore a CSV backup, replacing current data |
| POST | `/api/demo` | Replace business data with the sample café |
| POST | `/api/reset` | Delete all business data, keeping shop settings |
| GET/POST | `/api/ingredients` | List / create ingredients, including made-in-house bases |
| PUT/DELETE | `/api/ingredients/:id` | Edit / delete (blocked if used in a recipe) |
| GET/POST | `/api/packaging` | List / create packaging materials |
| PUT/DELETE | `/api/packaging/:id` | Edit / delete (blocked if used by a beverage) |
| GET/POST | `/api/products` | List / create beverages with recipes |
| PUT/DELETE | `/api/products/:id` | Edit / delete a beverage |
| GET | `/api/day?date=YYYY-MM-DD&shift=am\|mid\|pm\|gy` | Count sheet state for one shift; carries forward the previous shift's closing |
| GET/POST | `/api/closings` | List / save a shift closing (upsert by date + shift) |
| GET/DELETE | `/api/closings/:id` | Snapshot detail / delete |
| GET | `/api/report?from=YYYY-MM-DD&to=YYYY-MM-DD` | Aggregated consumption, stock movement and variance for a date range |

## Structure

```
server/
  db.js        schema, queries, demo seed
  backup.js    CSV backup export and validated restore
  variance.js  the usage and variance math
  index.js     Express API and static serving
src/
  pages/       Dashboard, Recipes, Library, Inventory, Report, History, Settings
  components/  modal, header, variance pill, icons
  lib.ts       formatting, recipe costing, client-side variance mirror
```

Closings snapshot their computed lines, so editing a recipe later never rewrites
past history.
