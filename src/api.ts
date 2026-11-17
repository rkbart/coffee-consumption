import {
  ingredientRepository,
} from './repositories/ingredient-repository';
import {
  packagingRepository,
} from './repositories/packaging-repository';
import type { PackagingSetInput } from './repositories/packaging-repository';
import {
  productRepository,
  type ProductInput,
} from './repositories/product-repository';

export type { ProductInput };
import {
  closingRepository,
} from './repositories/closing-repository';
import {
  settingsRepository,
} from './repositories/settings-repository';
import {
  importBackupCsv,
  exportBackupCsv,
} from './repositories/backup-repository';
import {
  loadDemo,
  resetDatabase,
  type DataCounts,
} from './db/seed';
import type {
  ClosingDetail,
  ClosingSummary,
  CountEntry,
  DayResponse,
  EndingReport,
  Ingredient,
  PackagingMaterial,
  Product,
  SaleEntry,
  ShiftId,
  ShopSettings,
} from './types';
import { isFlagged, round2 } from './lib';

export interface IngredientInput {
  name: string;
  unit: 'g' | 'ml' | 'pcs';
  category: string;
  pack_price: number;
  pack_size: number;
  waste_pct: number;
}

export type PackagingInput = PackagingSetInput;

/**
 * Client-side data layer over the OPFS/SQLite database (sqlocal + Drizzle).
 * Replaces the old Express API — one browser, one profile, no users, no auth.
 * Every repository call talks to the local database directly; there is no
 * server round-trip.
 */

export const api = {
  settings: async (): Promise<ShopSettings> => ({
    currency: await settingsRepository.getCurrency(),
  }),

  updateSettings: async (body: ShopSettings): Promise<ShopSettings> => {
    await settingsRepository.set('currency', body.currency);
    return { currency: body.currency };
  },

  importBackup: (csv: string) =>
    importBackupCsv(csv) as Promise<{ ok: boolean; counts: DataCounts }>,

  exportBackup: () => exportBackupCsv() as Promise<string>,

  loadDemo: () =>
    loadDemo().then((counts) => ({ ok: true, counts }) as { ok: boolean; counts: DataCounts }),

  resetDatabase: () => resetDatabase(),

  ingredients: () => ingredientRepository.getAll() as Promise<Ingredient[]>,

  createIngredient: (body: IngredientInput) =>
    ingredientRepository.create(body).then((rows) => rows[0] as Ingredient),

  updateIngredient: (id: number, body: IngredientInput) =>
    ingredientRepository.update(id, body).then((rows) => rows[0] as Ingredient),

  deleteIngredient: (id: number) => ingredientRepository.delete(id),

  packaging: () => packagingRepository.getAll() as Promise<PackagingMaterial[]>,

  createPackaging: (body: PackagingInput) =>
    packagingRepository.create(body).then((rows) => rows[0] as PackagingMaterial),

  updatePackaging: (id: number, body: PackagingInput) =>
    packagingRepository.update(id, body).then((rows) => rows[0] as PackagingMaterial),

  deletePackaging: (id: number) => packagingRepository.delete(id),

  products: () => productRepository.getAll() as Promise<Product[]>,

  createProduct: (body: ProductInput) => productRepository.create(body) as Promise<Product>,

  updateProduct: (id: number, body: ProductInput) =>
    productRepository.update(id, body) as Promise<Product>,

  deleteProduct: (id: number) => productRepository.delete(id),

  day: async (date: string, shift: ShiftId): Promise<DayResponse> => {
    const [ingredients, closingRow, closingsForDate, previous] =
      await Promise.all([
        ingredientRepository.getAll(),
        closingRepository.getClosingByDate(date, shift),
        closingRepository.closingsForDate(date),
        closingRepository.previousClosingFor(date, shift),
      ]);

    const closing = closingRow
      ? await closingRepository.getClosingDetail(closingRow.id)
      : null;

    const counts: CountEntry[] = ingredients.map((ingredient) => {
      const saved = closing?.lines?.find((line) => line.ingredient_id === ingredient.id);
      const carried = previous?.lines?.find((line) => line.ingredient_id === ingredient.id);
      return {
        ingredient_id: ingredient.id,
        opening: saved?.opening ?? carried?.closing ?? 0,
        deliveries: saved?.deliveries ?? 0,
        waste: saved?.waste ?? 0,
        closing: saved?.closing ?? 0,
      };
    });

    const sales: SaleEntry[] = closing?.sales?.map((sale) => ({
      product_id: sale.product_id ?? 0,
      quantity: sale.quantity,
    })) ?? [];

    const shifts = closingsForDate.map((c) => ({
      shift: c.shift as ShiftId,
      id: c.id,
      prepared_by: c.prepared_by,
    }));

    return {
      date,
      shift,
      closing: closing ?? null,
      carried_from: previous?.date ?? null,
      carried_from_shift: (previous?.shift ?? null) as ShiftId | null,
      shifts,
      counts,
      sales,
    };
  },

  saveClosing: (body: {
    date: string;
    shift: ShiftId;
    prepared_by: string;
    notes: string;
    counts: CountEntry[];
    sales: SaleEntry[];
  }) => closingRepository.saveClosing(body) as Promise<ClosingDetail>,

  closings: () => closingRepository.listClosings() as Promise<ClosingSummary[]>,

  closing: (id: number) => closingRepository.getClosingDetail(id) as Promise<ClosingDetail>,

  deleteClosing: (id: number) => closingRepository.deleteClosing(id),

  overview: async () => {
    const closings = await closingRepository.listClosings();
    const latestId = closings[0]?.id ?? null;
    const latest = latestId ? await closingRepository.getClosingDetail(latestId) : null;
    const counts = {
      ingredients: (await ingredientRepository.getAll()).length,
      beverages: (await productRepository.getAll()).length,
      closings: closings.length,
    };
    return { closings: closings.slice(0, 8), latest, counts };
  },

  report: async (from: string, to: string): Promise<EndingReport> => {
    const allClosings = await closingRepository.listClosings();
    const details: ClosingDetail[] = [];
    for (const closing of allClosings) {
      if (closing.date < from || closing.date > to) continue;
      const detail = await closingRepository.getClosingDetail(closing.id);
      if (detail) details.push(detail);
    }

    const ingredientMap = new Map<string, any>();
    const salesMap = new Map<string, any>();
    const notes: any[] = [];
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
        const key = `${sale.product_name}\u0000${sale.size_label || ''}`;
        const entry = salesMap.get(key) || {
          product_name: sale.product_name,
          size_label: sale.size_label || '',
          quantity: 0,
        };
        entry.quantity += Number(sale.quantity) || 0;
        totalCups += Number(sale.quantity) || 0;
        salesMap.set(key, entry);
      }

      const note = String(detail.notes || '').trim();
      if (note) {
        notes.push({
          date: detail.date,
          shift: detail.shift,
          prepared_by: detail.prepared_by,
          notes: note,
        });
      }
      if (closeFlagged) flaggedCloses += 1;
    }

    const lines = [...ingredientMap.values()]
      .map((entry: any) => {
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
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

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
      sales: [...salesMap.values()].sort((a: any, b: any) => b.quantity - a.quantity),
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
  },
};
