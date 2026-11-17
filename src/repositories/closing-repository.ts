import { db } from '../db/client';
import { and, eq } from 'drizzle-orm';
import {
  closings as closingsTable,
  closingLines as closingLinesTable,
  closingSales as closingSalesTable,
  ingredients as ingredientsTable,
} from '../db/schema';
import { productRepository } from './product-repository';
import { computeUsage, isFlagged } from '../lib';
import type {
  ClosingDetail,
  ClosingSummary,
  CountEntry,
  Ingredient,
  SaleEntry,
  ShiftId,
} from '../types';

const SHIFT_ORDER: Record<ShiftId, number> = { am: 0, mid: 1, pm: 2, gy: 3 };

export const closingRepository = {
  async getClosingByDate(date: string, shift: string) {
    const rows = await db
      .select()
      .from(closingsTable)
      .where(and(eq(closingsTable.date, date), eq(closingsTable.shift, shift)));
    return rows[0] ?? null;
  },

  async closingsForDate(date: string) {
    const rows = await db.select().from(closingsTable).where(eq(closingsTable.date, date));
    return rows.sort(
      (a, b) => (SHIFT_ORDER[a.shift as ShiftId] ?? 3) - (SHIFT_ORDER[b.shift as ShiftId] ?? 3),
    );
  },

  async getClosingDetail(id: number): Promise<ClosingDetail | null> {
    const closing = await db.select().from(closingsTable).where(eq(closingsTable.id, id));
    if (closing.length === 0) return null;
    const [lines, sales] = await Promise.all([
      db
        .select()
        .from(closingLinesTable)
        .where(eq(closingLinesTable.closing_id, id))
        .orderBy(closingLinesTable.id),
      db
        .select()
        .from(closingSalesTable)
        .where(eq(closingSalesTable.closing_id, id))
        .orderBy(closingSalesTable.id),
    ]);
    return {
      ...closing[0],
      lines: lines.map((line) => ({ ...line, unit: line.unit as import('../types').Unit })),
      sales,
    } as ClosingDetail;
  },

  /** The most recent closing before a date + shift, in AM → MID → PM → GY order. */
  async previousClosingFor(date: string, shift: string) {
    const rank = SHIFT_ORDER[shift as ShiftId] ?? 0;
    const rows = await db.select().from(closingsTable);
    const previous = rows
      .filter(
        (c) =>
          c.date < date ||
          (c.date === date && (SHIFT_ORDER[c.shift as ShiftId] ?? 3) < rank),
      )
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          (SHIFT_ORDER[b.shift as ShiftId] ?? 3) -
            (SHIFT_ORDER[a.shift as ShiftId] ?? 3),
      )[0];
    if (!previous) return null;
    const lines = await db
      .select()
      .from(closingLinesTable)
      .where(eq(closingLinesTable.closing_id, previous.id));
    return { date: previous.date, shift: previous.shift as ShiftId, lines };
  },

  async listClosings(): Promise<ClosingSummary[]> {
    const [closings, lines] = await Promise.all([
      db.select().from(closingsTable),
      db.select().from(closingLinesTable),
    ]);
    const linesByClosing = new Map<number, typeof lines>();
    for (const line of lines) {
      if (!linesByClosing.has(line.closing_id)) linesByClosing.set(line.closing_id, []);
      linesByClosing.get(line.closing_id)!.push(line);
    }
    return closings
      .map((c) => {
        const closingLines = linesByClosing.get(c.id) || [];
        return {
          id: c.id,
          date: c.date,
          shift: c.shift as ShiftId,
          prepared_by: c.prepared_by,
          notes: c.notes,
          created_at: c.created_at,
          ingredient_count: closingLines.length,
          flagged_count: closingLines.filter(isFlagged).length,
        };
      })
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          (SHIFT_ORDER[b.shift as ShiftId] ?? 3) - (SHIFT_ORDER[a.shift as ShiftId] ?? 3),
      );
  },

  async saveClosing({
    date,
    shift = 'pm',
    prepared_by = '',
    notes = '',
    counts = [],
    sales = [],
  }: {
    date: string;
    shift?: string;
    prepared_by?: string;
    notes?: string;
    counts: CountEntry[];
    sales: SaleEntry[];
  }): Promise<ClosingDetail | null> {
    const [ingredients, products] = await Promise.all([
      db.select().from(ingredientsTable),
      productRepository.getAll(),
    ]);

    const lines = computeUsage({
      ingredients: ingredients as unknown as Ingredient[],
      products,
      sales,
      counts,
    });

    // Upsert by date + shift: remove any existing snapshot for this slot.
    const existing = await db
      .select()
      .from(closingsTable)
      .where(and(eq(closingsTable.date, date), eq(closingsTable.shift, shift)));
    if (existing.length > 0) {
      await db
        .delete(closingLinesTable)
        .where(eq(closingLinesTable.closing_id, existing[0].id));
      await db
        .delete(closingSalesTable)
        .where(eq(closingSalesTable.closing_id, existing[0].id));
      await db.delete(closingsTable).where(eq(closingsTable.id, existing[0].id));
    }

    const [closing] = await db
      .insert(closingsTable)
      .values({
        date,
        shift,
        prepared_by,
        notes,
        created_at: new Date().toISOString().slice(0, 10),
      })
      .returning();
    const closingId = closing.id;

    for (const line of lines) {
      await db.insert(closingLinesTable).values({
        closing_id: closingId,
        ingredient_id: line.ingredient_id,
        ingredient_name: line.name,
        unit: line.unit,
        opening: line.opening,
        deliveries: line.deliveries,
        waste: line.waste,
        closing: line.closing,
        actual_usage: line.actual_usage,
        theoretical_usage: line.theoretical_usage,
        variance: line.variance,
      });
    }

    const salesById = new Map(sales.map((s) => [Number(s.product_id), Number(s.quantity) || 0]));
    for (const product of products) {
      const quantity = salesById.get(product.id) || 0;
      if (quantity > 0) {
        await db.insert(closingSalesTable).values({
          closing_id: closingId,
          product_id: product.id,
          product_name: product.name,
          size_label: product.size_label,
          quantity,
        });
      }
    }

    return this.getClosingDetail(closingId);
  },

  async deleteClosing(id: number) {
    await db.delete(closingsTable).where(eq(closingsTable.id, id));
  },
};