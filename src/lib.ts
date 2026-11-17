import type {
  CountEntry,
  Ingredient,
  PackagingComponent,
  PackagingMaterial,
  Product,
  ProductPackaging,
  RecipeItem,
  ReportPeriod,
  SaleEntry,
  ShiftId,
  Unit,
} from "./types";

export const DEFAULT_CURRENCY = "₱";

let currencySymbol = (() => {
  try {
    return localStorage.getItem("brew-currency") || DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
})();

export const getCurrencySymbol = () => currencySymbol;

export function setCurrencySymbol(value: string) {
  currencySymbol = value.trim() || DEFAULT_CURRENCY;
  try {
    localStorage.setItem("brew-currency", currencySymbol);
  } catch {
    /* storage can be unavailable in private or embedded contexts */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("brew-currency", { detail: currencySymbol }),
    );
  }
}

export const SHIFTS: { id: ShiftId; short: string; label: string; time: string }[] = [
  { id: "am", short: "AM", label: "Morning", time: "6am – 12pm" },
  { id: "mid", short: "MID", label: "Mid shift", time: "12pm – 5pm" },
  { id: "pm", short: "PM", label: "Closing shift", time: "5pm – 10pm" },
  { id: "gy", short: "GY", label: "Graveyard", time: "10pm – 6am" },
];

export const isShiftId = (value: unknown): value is ShiftId =>
  SHIFTS.some((shift) => shift.id === value);

export const shiftMeta = (id: ShiftId) =>
  SHIFTS.find((shift) => shift.id === id) ?? SHIFTS[0];

export const shiftShort = (id: ShiftId) => shiftMeta(id).short;

export const shiftLabel = (id: ShiftId) =>
  `${shiftMeta(id).short} · ${shiftMeta(id).label}`;

/** Best guess at the shift on the floor right now, used for a fresh count. */
export function currentShift(now = new Date()): ShiftId {
  const hour = now.getHours();
  if (hour >= 6 && hour < 12) return "am";
  if (hour >= 12 && hour < 17) return "mid";
  if (hour >= 17 && hour < 22) return "pm";
  return "gy";
}

export const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * theoretical usage = sum((batch recipe quantity / yield) x units sold)
 * actual usage      = opening + deliveries - waste - closing
 * variance          = actual - theoretical
 *
 * Ported from the old server-side variance.js so snapshot math lives on the
 * client now (OPFS database, no server).
 */
export function computeUsage({
  ingredients,
  products,
  sales,
  counts,
}: {
  ingredients: Ingredient[];
  products: Product[];
  sales: { product_id: number; quantity: number }[];
  counts: { ingredient_id: number; opening: number; deliveries: number; waste: number; closing: number }[];
}) {
  const soldByProduct = new Map(
    sales.map((s) => [Number(s.product_id), Number(s.quantity) || 0]),
  );

  const theoretical = new Map(ingredients.map((i) => [i.id, 0]));
  for (const product of products) {
    const qty = soldByProduct.get(product.id) || 0;
    if (!qty) continue;
    const portions = product.yield_qty > 0 ? product.yield_qty : 1;
    for (const line of product.recipe) {
      theoretical.set(
        line.ingredient_id,
        (theoretical.get(line.ingredient_id) || 0) + (line.qty / portions) * qty,
      );
    }
  }

  const countByIngredient = new Map(
    counts.map((c) => [Number(c.ingredient_id), c]),
  );

  return ingredients.map((ingredient) => {
    const count = (countByIngredient.get(ingredient.id) ?? {}) as CountEntry;
    const opening = Number(count.opening) || 0;
    const deliveries = Number(count.deliveries) || 0;
    const waste = Number(count.waste) || 0;
    const closing = Number(count.closing) || 0;

    const theoreticalUsage = round2(theoretical.get(ingredient.id) || 0);
    const actualUsage = round2(opening + deliveries - waste - closing);

    return {
      ingredient_id: ingredient.id,
      name: ingredient.name,
      unit: ingredient.unit,
      opening: round2(opening),
      deliveries: round2(deliveries),
      waste: round2(waste),
      closing: round2(closing),
      actual_usage: actualUsage,
      theoretical_usage: theoreticalUsage,
      variance: round2(actualUsage - theoreticalUsage),
    };
  });
}

export const money = (n: number, digits = 2) =>
  `${n < 0 ? "−" : ""}${currencySymbol}${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(round2(n)))}`;

/** Unit costs are often fractions of a cent, so show enough precision to be useful. */
export const unitMoney = (n: number) =>
  money(n, Math.abs(n) >= 0.1 ? 2 : Math.abs(n) >= 0.01 ? 3 : 4);

export const fmt = (n: number, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(round2(n));

export const fmtSigned = (n: number) =>
  `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n), Number.isInteger(n) ? 0 : 1)}`;

export const unitLabel = (unit: Unit) => (unit === "pcs" ? "pcs" : unit);

export function todayISO() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function formatDate(iso: string, style: "short" | "long" = "short") {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-US",
    style === "long"
      ? { weekday: "long", month: "long", day: "numeric", year: "numeric" }
      : { weekday: "short", month: "short", day: "numeric" },
  );
}

const localISO = (date: Date) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
};

const parseISO = (iso: string) => new Date(`${iso}T12:00:00`);

export function startOfWeek(iso: string) {
  const d = parseISO(iso);
  const sinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - sinceMonday);
  return localISO(d);
}

export function startOfMonth(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonth(iso: string) {
  const d = parseISO(iso);
  return localISO(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
}

export function formatDateRange(from: string, to: string) {
  return from === to
    ? formatDate(from, "long")
    : `${formatDate(from, "long")} – ${formatDate(to, "long")}`;
}

/** Calendar ranges used by the ending report. Week starts on Monday. */
export function reportRange(period: ReportPeriod, today = todayISO()) {
  const d = parseISO(today);
  const year = d.getFullYear();
  const month = d.getMonth();

  switch (period) {
    case "today":
      return { from: today, to: today };
    case "week":
      return { from: startOfWeek(today), to: today };
    case "last-week": {
      const thisMonday = startOfWeek(today);
      return { from: shiftDate(thisMonday, -7), to: shiftDate(thisMonday, -1) };
    }
    case "month":
      return { from: startOfMonth(today), to: today };
    case "last-month":
      return {
        from: localISO(new Date(year, month - 1, 1, 12)),
        to: localISO(new Date(year, month, 0, 12)),
      };
    case "year":
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    case "ytd":
      return { from: `${year}-01-01`, to: today };
    case "last-30":
      return { from: shiftDate(today, -29), to: today };
    default:
      return { from: today, to: today };
  }
}

export interface LiveLine {
  ingredient: Ingredient;
  opening: number;
  deliveries: number;
  waste: number;
  closing: number;
  actual: number;
  theoretical: number;
  variance: number;
}

/** Mirrors the server's variance math so the form can update as you type. */
export function liveLines(
  ingredients: Ingredient[],
  products: Product[],
  counts: CountEntry[],
  sales: SaleEntry[],
): LiveLine[] {
  const countsById = new Map(counts.map((c) => [c.ingredient_id, c]));
  const soldById = new Map(sales.map((s) => [s.product_id, Number(s.quantity) || 0]));
  const theoretical = new Map<number, number>(ingredients.map((i) => [i.id, 0]));

  for (const product of products) {
    const quantity = soldById.get(product.id) || 0;
    if (!quantity) continue;
    const portions = product.yield_qty > 0 ? product.yield_qty : 1;
    for (const line of product.recipe) {
      theoretical.set(
        line.ingredient_id,
        (theoretical.get(line.ingredient_id) || 0) + (line.qty / portions) * quantity,
      );
    }
  }

  return ingredients.map((ingredient) => {
    const count = countsById.get(ingredient.id);
    const opening = Number(count?.opening) || 0;
    const deliveries = Number(count?.deliveries) || 0;
    const waste = Number(count?.waste) || 0;
    const closing = Number(count?.closing) || 0;
    const theoreticalUsage = round2(theoretical.get(ingredient.id) || 0);
    const actual = round2(opening + deliveries - waste - closing);
    return {
      ingredient,
      opening,
      deliveries,
      waste,
      closing,
      actual,
      theoretical: theoreticalUsage,
      variance: round2(actual - theoreticalUsage),
    };
  });
}

export function tolerance(line: { theoretical: number; variance: number }) {
  return Math.max(2, Math.abs(line.theoretical) * 0.02);
}

export function isFlagged(line: {
  theoretical?: number;
  theoretical_usage?: number;
  variance: number;
}) {
  const theory = line.theoretical ?? line.theoretical_usage ?? 0;
  return Math.abs(line.variance) > tolerance({ theoretical: theory, variance: line.variance });
}

export function varianceStatus(line: { theoretical: number; variance: number }) {
  if (Math.abs(line.variance) <= tolerance(line)) return "on-target" as const;
  return line.variance > 0 ? "over" as const : "under" as const;
}

/* ----------------------------------------------------------- recipe costing */

export interface CostedLine {
  item: RecipeItem;
  ingredient?: Ingredient;
  netRecovery: number;
  unitCost: number;
  lineCost: number;
  missingCost: boolean;
}

export interface CostedPackagingLine {
  line: ProductPackaging;
  material?: PackagingMaterial;
  netRecovery: number;
  unitCost: number;
  lineCost: number;
  missingCost: boolean;
  components: {
    component: PackagingComponent;
    unitCost: number;
    lineCost: number;
    missingCost: boolean;
  }[];
}

export interface RecipeCost {
  lines: CostedLine[];
  ingredientCost: number;
  packagingLines: CostedPackagingLine[];
  foodCost: number;
  yieldQty: number;
  portionCost: number;
  provision: number;
  packaging: number;
  standardCost: number;
  targetPct: number;
  vatPct: number;
  suggestedNet: number;
  suggestedGross: number;
  sellingPrice: number | null;
  netPrice: number | null;
  actualFoodCostPct: number | null;
  margin: number | null;
  missingCosts: string[];
}

/**
 * Mirrors the costing sheet: pack price / net recovery gives a unit cost, the
 * recipe sums to a batch cost, and overheads + target food cost % suggest a menu
 * price. Made-in-house bases belong in the ingredient library and cost like any
 * other ingredient. A menu price, when set, shows the food cost achieved.
 */
export function recipeCost(
  product: Product,
  ingredients: Ingredient[],
  packagingMaterials: PackagingMaterial[] = [],
): RecipeCost {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const packagingById = new Map(packagingMaterials.map((p) => [p.id, p]));
  const missingCosts: string[] = [];

  const lines: CostedLine[] = product.recipe.map((item) => {
    const ingredient = byId.get(item.ingredient_id);
    const netRecovery =
      (ingredient?.pack_size ?? 0) * (1 - (ingredient?.waste_pct ?? 0) / 100);
    const missingCost = !ingredient || ingredient.pack_price <= 0 || netRecovery <= 0;
    if (missingCost && ingredient && !missingCosts.includes(ingredient.name)) {
      missingCosts.push(ingredient.name);
    }
    const unitCost = missingCost ? 0 : ingredient!.pack_price / netRecovery;
    return {
      item,
      ingredient,
      netRecovery,
      unitCost,
      lineCost: round2(unitCost * item.qty),
      missingCost,
    };
  });

  const packagingLines: CostedPackagingLine[] = (product.packaging ?? []).map((line) => {
    const material = packagingById.get(line.packaging_id);
    const components = (material?.components ?? []).map((component) => {
      const netRecovery = component.pack_size * (1 - component.waste_pct / 100);
      const missingCost = component.pack_price <= 0 || netRecovery <= 0;
      const unitCost = missingCost ? 0 : component.pack_price / netRecovery;
      if (missingCost && !missingCosts.includes(component.name)) {
        missingCosts.push(component.name);
      }
      return {
        component,
        unitCost,
        lineCost: round2(unitCost * component.qty_needed),
        missingCost,
      };
    });
    const missingCost = !material || components.length === 0 || components.some((component) => component.missingCost);
    if (!material || components.length === 0) {
      if (!missingCosts.includes(line.packaging_name)) missingCosts.push(line.packaging_name);
    }
    const unitCost = round2(components.reduce((sum, component) => sum + component.lineCost, 0));
    return {
      line,
      material,
      netRecovery: 1,
      unitCost,
      lineCost: round2(unitCost * line.qty),
      missingCost,
      components,
    };
  });

  const ingredientCost = round2(lines.reduce((sum, line) => sum + line.lineCost, 0));
  const foodCost = ingredientCost;
  const packaging = round2(
    packagingLines.reduce((sum, line) => sum + line.lineCost, 0),
  );
  const yieldQty = product.yield_qty > 0 ? product.yield_qty : 1;
  const portionCost = round2(foodCost / yieldQty);
  const provision = round2(portionCost * (product.provision_pct / 100));
  const standardCost = round2(portionCost + provision + packaging);

  const targetPct = product.target_food_cost_pct > 0 ? product.target_food_cost_pct : 33;
  const vatPct = product.vat_pct || 0;
  const suggestedNet = standardCost / (targetPct / 100);
  const suggestedGross = suggestedNet * (1 + vatPct / 100);

  const sellingPrice = product.selling_price ?? null;
  const netPrice = sellingPrice !== null ? sellingPrice / (1 + vatPct / 100) : null;
  const actualFoodCostPct =
    netPrice && netPrice > 0 ? (standardCost / netPrice) * 100 : null;
  const margin = netPrice !== null ? netPrice - standardCost : null;

  return {
    lines,
    ingredientCost,
    packagingLines,
    foodCost,
    yieldQty,
    portionCost,
    provision,
    packaging,
    standardCost,
    targetPct,
    vatPct,
    suggestedNet,
    suggestedGross,
    sellingPrice,
    netPrice,
    actualFoodCostPct,
    margin,
    missingCosts,
  };
}
