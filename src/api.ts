import type {
  ClosingDetail,
  ClosingSummary,
  DataCounts,
  DayResponse,
  EndingReport,
  Ingredient,
  Overview,
  PackagingMaterial,
  Product,
  ShiftId,
  ShopSettings,
  Unit,
} from "./types";

export interface IngredientInput {
  name: string;
  unit: Unit;
  category: string;
  pack_price: number;
  pack_size: number;
  waste_pct: number;
}

export interface PackagingInput {
  name: string;
  unit: Unit;
  pack_price: number;
  pack_size: number;
  waste_pct: number;
}

export interface ProductInput {
  name: string;
  category: string;
  size_label: string;
  yield_qty: number;
  provision_pct: number;
  target_food_cost_pct: number;
  vat_pct: number;
  selling_price: number | null;
  recipe: { ingredient_id: number; qty: number }[];
  packaging: { packaging_id: number; qty: number }[];
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep the status message */
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const api = {
  settings: () => request<ShopSettings>("/api/settings"),
  updateSettings: (body: ShopSettings) =>
    request<ShopSettings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  importBackup: (csv: string) =>
    request<{ ok: boolean; counts: DataCounts }>("/api/import", {
      method: "POST",
      body: JSON.stringify({ csv }),
    }),
  loadDemo: () =>
    request<{ ok: boolean; counts: DataCounts }>("/api/demo", { method: "POST" }),
  resetDatabase: () =>
    request<{ ok: boolean; counts: DataCounts }>("/api/reset", { method: "POST" }),

  ingredients: () => request<Ingredient[]>("/api/ingredients"),
  createIngredient: (body: IngredientInput) =>
    request<Ingredient>("/api/ingredients", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateIngredient: (id: number, body: IngredientInput) =>
    request<Ingredient>(`/api/ingredients/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteIngredient: (id: number) =>
    request<{ ok: boolean }>(`/api/ingredients/${id}`, { method: "DELETE" }),

  packaging: () => request<PackagingMaterial[]>("/api/packaging"),
  createPackaging: (body: PackagingInput) =>
    request<PackagingMaterial>("/api/packaging", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updatePackaging: (id: number, body: PackagingInput) =>
    request<PackagingMaterial>(`/api/packaging/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deletePackaging: (id: number) =>
    request<{ ok: boolean }>(`/api/packaging/${id}`, { method: "DELETE" }),

  products: () => request<Product[]>("/api/products"),
  createProduct: (body: ProductInput) =>
    request<Product>("/api/products", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateProduct: (id: number, body: ProductInput) =>
    request<Product>(`/api/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteProduct: (id: number) =>
    request<{ ok: boolean }>(`/api/products/${id}`, { method: "DELETE" }),

  day: (date: string, shift: ShiftId) =>
    request<DayResponse>(`/api/day?date=${encodeURIComponent(date)}&shift=${shift}`),
  saveClosing: (body: {
    date: string;
    shift: ShiftId;
    prepared_by: string;
    notes: string;
    counts: { ingredient_id: number; opening: number; deliveries: number; waste: number; closing: number }[];
    sales: { product_id: number; quantity: number }[];
  }) =>
    request<ClosingDetail>("/api/closings", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  closings: () => request<ClosingSummary[]>("/api/closings"),
  closing: (id: number) => request<ClosingDetail>(`/api/closings/${id}`),
  deleteClosing: (id: number) =>
    request<{ ok: boolean }>(`/api/closings/${id}`, { method: "DELETE" }),

  overview: () => request<Overview>("/api/overview"),

  report: (from: string, to: string) =>
    request<EndingReport>(
      `/api/report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
};
