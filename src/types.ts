export type Unit = "g" | "ml" | "pcs";

export type ShiftId = "am" | "mid" | "pm" | "gy";

export interface Ingredient {
  id: number;
  name: string;
  unit: Unit;
  category: string;
  /** Price paid for one purchase pack, in the café's currency. */
  pack_price: number;
  /** Counted units in that pack, e.g. 1000 for a 1 kg bag or 1 L carton. */
  pack_size: number;
  /** Percentage lost to trim, spillage or over-pour before the pack is usable. */
  waste_pct: number;
  sort_order: number;
}

export interface RecipeItem {
  id: number;
  product_id: number;
  ingredient_id: number;
  qty: number;
  ingredient_name: string;
  unit: Unit;
}

export interface PackagingComponent {
  id: number;
  packaging_id: number;
  name: string;
  description: string;
  unit: Unit;
  pack_price: number;
  pack_size: number;
  qty_needed: number;
  waste_pct: number;
  sort_order: number;
}

export interface PackagingMaterial {
  id: number;
  name: string;
  description: string;
  sort_order: number;
  components: PackagingComponent[];
}

export interface ProductPackaging {
  id: number;
  product_id: number;
  packaging_id: number;
  packaging_name: string;
  unit: Unit;
  qty: number;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  size_label: string;
  /** Servings produced by one batch of the recipe. */
  yield_qty: number;
  provision_pct: number;
  target_food_cost_pct: number;
  vat_pct: number;
  /** Menu price including VAT, or null if not set. */
  selling_price: number | null;
  recipe: RecipeItem[];
  packaging: ProductPackaging[];
}

export interface ClosingLine {
  id: number;
  closing_id: number;
  ingredient_id: number;
  ingredient_name: string;
  unit: Unit;
  opening: number;
  deliveries: number;
  waste: number;
  closing: number;
  actual_usage: number;
  theoretical_usage: number;
  variance: number;
}

export interface ClosingSale {
  id: number;
  closing_id: number;
  product_id: number | null;
  product_name: string;
  size_label: string;
  quantity: number;
}

export interface ClosingDetail {
  id: number;
  date: string;
  shift: ShiftId;
  prepared_by: string;
  notes: string;
  created_at: string;
  lines: ClosingLine[];
  sales: ClosingSale[];
}

export interface ClosingSummary {
  id: number;
  date: string;
  shift: ShiftId;
  prepared_by: string;
  notes: string;
  created_at: string;
  ingredient_count: number;
  flagged_count: number;
}

export interface DayShiftSummary {
  shift: ShiftId;
  id: number;
  prepared_by: string;
}

export interface CountEntry {
  ingredient_id: number;
  opening: number;
  deliveries: number;
  waste: number;
  closing: number;
}

export interface SaleEntry {
  product_id: number;
  quantity: number;
}

export interface DayResponse {
  date: string;
  shift: ShiftId;
  closing: ClosingDetail | null;
  carried_from: string | null;
  carried_from_shift: ShiftId | null;
  shifts: DayShiftSummary[];
  counts: CountEntry[];
  sales: SaleEntry[];
}

export interface ShopSettings {
  currency: string;
}

export interface DataCounts {
  ingredients: number;
  packaging: number;
  products: number;
  closings: number;
}

export interface Overview {
  closings: ClosingSummary[];
  latest: ClosingDetail | null;
  counts: { ingredients: number; beverages: number; closings: number };
}

export type ReportPeriod =
  | "today"
  | "week"
  | "last-week"
  | "month"
  | "last-month"
  | "year"
  | "ytd"
  | "last-30"
  | "custom";

export interface ReportLine {
  ingredient_id: number;
  name: string;
  unit: Unit;
  first_date: string;
  last_date: string;
  opening: number;
  deliveries: number;
  waste: number;
  ending_stock: number;
  actual_usage: number;
  theoretical_usage: number;
  variance: number;
  variance_pct: number | null;
  closing_count: number;
  flagged_closes: number;
}

export interface ReportSale {
  product_name: string;
  size_label: string;
  quantity: number;
}

export interface ReportClosing {
  id: number;
  date: string;
  shift: ShiftId;
  prepared_by: string;
  notes: string;
  flagged_count: number;
}

export interface ReportNote {
  date: string;
  shift: ShiftId;
  prepared_by: string;
  notes: string;
}

export interface EndingReport {
  from: string;
  to: string;
  generated_at: string;
  closing_count: number;
  total_cups: number;
  flagged_lines: number;
  flagged_closes: number;
  first_date: string | null;
  last_date: string | null;
  lines: ReportLine[];
  sales: ReportSale[];
  notes: ReportNote[];
  closings: ReportClosing[];
}
