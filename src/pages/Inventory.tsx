import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/Pagination";
import SearchField from "../components/SearchField";
import VariancePill from "../components/VariancePill";
import { useDebouncedValue } from "../hooks";
import { api } from "../api";
import type { DayShiftSummary, Ingredient, Product, ShiftId, Unit } from "../types";
import {
  SHIFTS,
  currentShift,
  fmt,
  fmtSigned,
  formatDate,
  isFlagged,
  isShiftId,
  liveLines,
  shiftDate,
  shiftLabel,
  shiftShort,
  todayISO,
  unitLabel,
  varianceStatus,
} from "../lib";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconCoffee,
  IconMilk,
  IconSpark,
} from "../components/Icons";

type CountDraft = {
  opening: string;
  deliveries: string;
  waste: string;
  closing: string;
};

const emptyDraft = (): CountDraft => ({
  opening: "",
  deliveries: "",
  waste: "",
  closing: "",
});

const isISODate = (value: string | null): value is string =>
  Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

const DRINKS_PER_PAGE = 10;

const matchesQuery = (query: string, values: (string | number | null | undefined)[]) =>
  !query || values.some((value) => String(value ?? "").toLowerCase().includes(query));

export default function Inventory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [date, setDate] = useState(() =>
    isISODate(searchParams.get("date")) ? (searchParams.get("date") as string) : todayISO(),
  );
  const [shift, setShift] = useState<ShiftId>(() => {
    const fromUrl = searchParams.get("shift");
    return isShiftId(fromUrl) ? fromUrl : currentShift();
  });
  const [preparedBy, setPreparedBy] = useState("");
  const [dayShifts, setDayShifts] = useState<DayShiftSummary[]>([]);
  const [menuGroup, setMenuGroup] = useState("all");
  const [saleSearch, setSaleSearch] = useState("");
  const debouncedSaleSearch = useDebouncedValue(saleSearch, 250);
  const [salePage, setSalePage] = useState(1);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [drafts, setDrafts] = useState<Record<number, CountDraft>>({});
  const [salesDrafts, setSalesDrafts] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  const [savedClosing, setSavedClosing] = useState<boolean>(false);
  const [carriedFrom, setCarriedFrom] = useState<string | null>(null);
  const [carriedShift, setCarriedShift] = useState<ShiftId | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    setSearchParams({ date, shift }, { replace: true });
  }, [date, shift, setSearchParams]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    Promise.all([api.ingredients(), api.products(), api.day(date, shift)])
      .then(([nextIngredients, nextProducts, day]) => {
        if (ignore) return;
        setIngredients(nextIngredients);
        setProducts(nextProducts);

        const nextCounts: Record<number, CountDraft> = {};
        for (const ingredient of nextIngredients) {
          const saved = day.counts.find((c) => c.ingredient_id === ingredient.id);
          nextCounts[ingredient.id] = saved
            ? {
                opening: String(saved.opening || ""),
                deliveries: String(saved.deliveries || ""),
                waste: String(saved.waste || ""),
                closing: String(saved.closing || ""),
              }
            : emptyDraft();
        }
        const nextSales: Record<number, string> = {};
        for (const product of nextProducts) {
          const saved = day.sales.find((s) => s.product_id === product.id);
          nextSales[product.id] = String(saved?.quantity || "");
        }

        setDrafts(nextCounts);
        setSalesDrafts(nextSales);
        setNotes(day.closing?.notes ?? "");
        setPreparedBy(day.closing?.prepared_by ?? "");
        setSavedClosing(Boolean(day.closing));
        setCarriedFrom(day.carried_from);
        setCarriedShift(day.carried_from_shift);
        setDayShifts(day.shifts);
        setError("");
      })
      .catch((err) => {
        if (!ignore) setError(err instanceof Error ? err.message : "Could not load the day");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [date, shift]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const counts = useMemo(
    () =>
      ingredients.map((ingredient) => {
        const draft = drafts[ingredient.id] || emptyDraft();
        return {
          ingredient_id: ingredient.id,
          opening: Number(draft.opening) || 0,
          deliveries: Number(draft.deliveries) || 0,
          waste: Number(draft.waste) || 0,
          closing: Number(draft.closing) || 0,
        };
      }),
    [ingredients, drafts],
  );

  const sales = useMemo(
    () =>
      products.map((product) => ({
        product_id: product.id,
        quantity: Number(salesDrafts[product.id]) || 0,
      })),
    [products, salesDrafts],
  );

  const lines = useMemo(
    () => liveLines(ingredients, products, counts, sales),
    [ingredients, products, counts, sales],
  );

  const totalDrinks = sales.reduce((sum, sale) => sum + sale.quantity, 0);
  const flagged = lines.filter(isFlagged);

  const byUnit = (unit: Unit) => {
    const relevant = lines.filter((line) => line.ingredient.unit === unit);
    return {
      theoretical: relevant.reduce((sum, line) => sum + line.theoretical, 0),
      actual: relevant.reduce((sum, line) => sum + line.actual, 0),
      variance: relevant.reduce((sum, line) => sum + line.variance, 0),
    };
  };
  const coffee = byUnit("g");
  const milk = byUnit("ml");

  const setCount = (id: number, field: keyof CountDraft, value: string) => {
    setDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] || emptyDraft()), [field]: value },
    }));
  };

  const setSale = (id: number, value: string) => {
    setSalesDrafts((current) => ({ ...current, [id]: value }));
  };

  const stepSale = (id: number, delta: number) => {
    setSalesDrafts((current) => {
      const next = Math.max(0, (Number(current[id]) || 0) + delta);
      return { ...current, [id]: next === 0 ? "" : String(next) };
    });
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const saved = await api.saveClosing({
        date,
        shift,
        prepared_by: preparedBy.trim(),
        notes,
        counts,
        sales,
      });
      setSavedClosing(true);
      setCarriedFrom(null);
      setCarriedShift(null);
      setDayShifts((current) => {
        const next = current.filter((row) => row.shift !== shift);
        next.push({ shift, id: saved.id, prepared_by: preparedBy.trim() });
        return SHIFTS.map((row) => next.find((entry) => entry.shift === row.id)).filter(
          (row): row is DayShiftSummary => Boolean(row),
        );
      });
      setToast(`${shiftShort(shift)} closing saved for ${formatDate(date)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the closing");
    } finally {
      setSaving(false);
    }
  };

  const saleQuery = debouncedSaleSearch.trim().toLowerCase();
  const menuGroups = [...new Set(products.map((product) => product.category))].sort();
  const visibleProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          (menuGroup === "all" || product.category === menuGroup) &&
          matchesQuery(saleQuery, [
            product.name,
            product.category,
            product.size_label,
            ...product.recipe.map((line) => line.ingredient_name),
          ]),
      ),
    [products, menuGroup, saleQuery],
  );

  useEffect(() => {
    setSalePage(1);
  }, [saleQuery, menuGroup]);

  const salePageCount = Math.max(1, Math.ceil(visibleProducts.length / DRINKS_PER_PAGE));
  const safeSalePage = Math.min(salePage, salePageCount);
  const pagedProducts = visibleProducts.slice(
    (safeSalePage - 1) * DRINKS_PER_PAGE,
    safeSalePage * DRINKS_PER_PAGE,
  );
  const productGroups = pagedProducts.reduce<Record<string, Product[]>>(
    (acc, product) => {
      (acc[product.category] ||= []).push(product);
      return acc;
    },
    {},
  );

  return (
    <>
      <PageHeader
        eyebrow="Closing time"
        title="Daily count"
        description="Enter what you opened with, what was delivered or wasted, and what is left. Compare it against the recipe and POS usage."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-1.5 hover:bg-surface-2 rounded-lg text-muted hover:text-accent transition-colors"
              aria-label="Previous day"
              onClick={() => setDate(shiftDate(date, -1))}
            >
              <IconArrowLeft size={17} />
            </button>
            <label className="relative flex items-center gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
              />
              <span className="text-sm font-medium text-ink">{formatDate(date)}</span>
            </label>
            <button
              type="button"
              className="p-1.5 hover:bg-surface-2 rounded-lg text-muted hover:text-accent transition-colors"
              aria-label="Next day"
              onClick={() => setDate(shiftDate(date, 1))}
            >
              <IconArrowRight size={17} />
            </button>
          </div>
        }
      />

      <section className="bg-surface border border-line rounded-lg p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Shift</p>
            <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Count shift">
              {SHIFTS.map((option) => {
                const saved = dayShifts.find((row) => row.shift === option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected={shift === option.id}
                    className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                      shift === option.id
                        ? "bg-accent-soft text-accent-dark"
                        : "text-ink-soft hover:bg-surface-2"
                    }`}
                    onClick={() => setShift(option.id)}
                  >
                    <span className="text-xs">{option.short}</span>
                    <span className="flex flex-col text-left">
                      <strong className="text-ink">{option.label}</strong>
                      <span className="text-xs text-muted">{option.time}</span>
                    </span>
                    {saved && (
                      <span className="ml-2 text-green" title={`Saved by ${saved.prepared_by || "unnamed"}`}>
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider block">Prepared by</span>
            <input
              value={preparedBy}
              onChange={(event) => setPreparedBy(event.target.value)}
              placeholder="Name or initials on this shift"
              maxLength={80}
              className="bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
            />
            <small className="text-xs text-muted">Shown beside this shift in history and reports.</small>
          </label>
        </div>
      </section>

      {error && (
        <div className="bg-red-soft border border-red rounded-lg p-3 flex items-center gap-2">
          {error}
        </div>
      )}
      {carriedFrom && !savedClosing && (
        <div className="bg-accent-soft border border-accent rounded-lg p-3 flex items-center gap-2">
          <IconSpark size={17} />
          <span>
            Opening stock carried over from the {formatDate(carriedFrom)}
            {carriedShift ? ` ${shiftShort(carriedShift)}` : ""} close. Adjust it if the
            shelf count disagreed.
          </span>
        </div>
      )}
      {savedClosing && (
        <div className="bg-green-soft border border-green rounded-lg p-3 flex items-center gap-2">
          <IconCheck size={16} />
          <span>
            The {shiftLabel(shift)} count is closed. Any change you save replaces this
            shift's snapshot.
          </span>
        </div>
      )}

      {loading ? (
        <div className="bg-surface border border-line rounded-lg h-64 flex items-center justify-center" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="flex flex-col gap-4 lg:col-span-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="flex items-center gap-3 bg-surface-2 rounded-lg p-3">
                <span className="w-8 h-8 rounded bg-green-soft text-green flex items-center justify-center"><IconCoffee size={20} /></span>
                <div>
                  <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Coffee usage</p>
                  <p className="text-lg font-serif font-medium text-ink">
                    {fmt(coffee.actual)} <span className="text-[10px] text-muted">g</span>
                    <span className="text-[10px] text-muted ml-1">actual</span>
                  </p>
                  <p className="text-xs text-muted">
                    Theory {fmt(coffee.theoretical)} g ·{" "}
                    <span className={coffee.variance === 0 ? "" : coffee.variance > 0 ? "text-red" : "text-green"}>
                      {fmtSigned(coffee.variance)} g
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-surface-2 rounded-lg p-3">
                <span className="w-8 h-8 rounded bg-accent-dark/10 text-accent-dark flex items-center justify-center"><IconMilk size={20} /></span>
                <div>
                  <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Milk usage</p>
                  <p className="text-lg font-serif font-medium text-ink">
                    {fmt(milk.actual)} <span className="text-[10px] text-muted">ml</span>
                    <span className="text-[10px] text-muted ml-1">actual</span>
                  </p>
                  <p className="text-xs text-muted">
                    Theory {fmt(milk.theoretical)} ml ·{" "}
                    <span className={milk.variance === 0 ? "" : milk.variance > 0 ? "text-red" : "text-green"}>
                      {fmtSigned(milk.variance)} ml
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-surface-2 rounded-lg p-3">
                <span className="w-8 h-8 rounded bg-line/50 text-ink-soft flex items-center justify-center"><IconCheck size={20} /></span>
                <div>
                  <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Drinks logged</p>
                  <p className="text-lg font-serif font-medium text-ink">
                    {fmt(totalDrinks)} <span className="text-[10px] text-muted">cups</span>
                  </p>
                  <p className="text-xs text-muted">{products.length} beverages on the menu</p>
                </div>
              </div>
            </div>

            <div className="bg-surface border border-line rounded-lg overflow-hidden">
              <div className="flex items-start justify-between mb-3 pb-2 border-b border-line px-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Inventory</p>
                  <h2 className="text-lg font-serif font-medium text-ink">Count sheet · {shiftShort(shift)}</h2>
                </div>
                <span className="text-xs text-muted">All weights in g · liquids in ml</span>
              </div>

              <div className="overflow-x-auto px-5 pb-4">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left border-b border-line">
                      <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider">Ingredient</th>
                      <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Opening</th>
                      <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Deliveries</th>
                      <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Waste</th>
                      <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Closing</th>
                      <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Actual use</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.ingredient.id} className="border-b border-line/50">
                        <td className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${line.ingredient.unit === "g" ? "bg-green" : "bg-accent-dark"}`}
                            />
                            <div>
                              <strong className="text-ink">{line.ingredient.name}</strong>
                              <span className="ml-0.5 text-xs text-muted">{unitLabel(line.ingredient.unit)}</span>
                            </div>
                          </div>
                        </td>
                        {(["opening", "deliveries", "waste", "closing"] as const).map((field) => (
                          <td key={field} className="pb-3 text-right">
                            <input
                              className="w-full bg-transparent border-none outline-none text-ink text-right focus:ring-0"
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              value={drafts[line.ingredient.id]?.[field] ?? ""}
                              onChange={(e) => setCount(line.ingredient.id, field, e.target.value)}
                              aria-label={`${line.ingredient.name} ${field}`}
                            />
                          </td>
                        ))}
                        <td className="pb-3 text-right">
                          <span className="font-medium text-ink">{fmt(line.actual)}</span>
                          <span className="ml-0.5 text-xs text-muted">{unitLabel(line.ingredient.unit)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="px-5 pt-3 pb-6 text-xs text-muted">
                Actual usage = opening + deliveries − waste − closing. The ending count is
                the one to take at the last minute of the shift.
              </p>
            </div>

            <div className="bg-surface border border-line rounded-lg overflow-hidden">
              <div className="flex items-start justify-between mb-3 pb-2 border-b border-line px-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Till</p>
                  <h2 className="text-lg font-serif font-medium text-ink">Drinks sold this shift</h2>
                </div>
                <span className="inline-block px-2 py-0.5 rounded-full bg-line/50 text-xs text-ink-soft">
                  {totalDrinks} cups
                </span>
              </div>
              <p className="px-5 pt-3 pb-2 text-xs text-muted">
                Log cups that did not go through the POS too — comps, staff drinks,
                remakes.
              </p>

              <div className="flex flex-wrap items-center gap-3 px-5 mb-4">
                <SearchField
                  value={saleSearch}
                  onChange={setSaleSearch}
                  placeholder="Search drinks, groups or ingredients…"
                  label="Search drinks sold this shift"
                />
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider block">Menu group</span>
                  <select
                    value={menuGroup}
                    onChange={(event) => setMenuGroup(event.target.value)}
                    className="bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
                  >
                    <option value="all">All menu groups</option>
                    {menuGroups.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="text-sm text-muted" aria-live="polite">
                  {saleQuery
                    ? `${visibleProducts.length} result${visibleProducts.length === 1 ? "" : "s"} for “${debouncedSaleSearch.trim()}”`
                    : menuGroup === "all"
                      ? `${products.length} beverages`
                      : `${visibleProducts.length} of ${products.length} beverages`}
                </span>
              </div>

              {visibleProducts.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-xs text-muted">
                    {saleQuery
                      ? `No drinks match “${debouncedSaleSearch.trim()}”.`
                      : `No beverages are in ${menuGroup} yet.`}
                  </p>
                  {(saleQuery || menuGroup !== "all") && (
                    <button
                      type="button"
                      className="mt-2 px-3 py-1.5 text-xs font-medium bg-surface border border-line rounded-lg text-ink-soft hover:bg-surface-2 hover:text-ink transition-colors"
                      onClick={() => {
                        setSaleSearch("");
                        setMenuGroup("all");
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="px-5 space-y-3">
                    {Object.entries(productGroups).map(([category, items]) => (
                      <div key={category}>
                        <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2">{category}</p>
                        {items.map((product) => (
                          <div className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-surface-2 transition-colors" key={product.id}>
                            <div className="flex flex-col gap-0.5">
                              <strong className="text-ink">{product.name}</strong>
                              <span className="text-xs text-muted">{product.size_label || "—"}</span>
                            </div>
                            <div className="flex gap-1 flex-wrap text-xs text-muted">
                              {product.recipe.map((line) => (
                                <span key={line.id}>
                                  {fmt(line.qty, 1)} {unitLabel(line.unit)} {line.ingredient_name.split(" ")[0]}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => stepSale(product.id, -1)}
                                aria-label={`Decrease ${product.name}`}
                                className="px-2 py-0.5 text-xs font-medium bg-surface border border-line rounded-lg text-ink-soft hover:bg-surface-2 hover:text-ink transition-colors"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min="0"
                                className="w-12 bg-transparent border-none outline-none text-ink text-right focus:ring-0"
                                placeholder="0"
                                value={salesDrafts[product.id] ?? ""}
                                onChange={(e) => setSale(product.id, e.target.value)}
                                aria-label={`${product.name} units sold`}
                              />
                              <button
                                type="button"
                                onClick={() => stepSale(product.id, 1)}
                                aria-label={`Increase ${product.name}`}
                                className="px-2 py-0.5 text-xs font-medium bg-surface border border-line rounded-lg text-ink-soft hover:bg-surface-2 hover:text-ink transition-colors"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <Pagination
                    page={safeSalePage}
                    pageCount={salePageCount}
                    total={visibleProducts.length}
                    pageSize={DRINKS_PER_PAGE}
                    onPageChange={setSalePage}
                    label="beverages"
                  />
                </>
              )}
            </div>
          </section>

          <aside className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-surface border border-line rounded-lg overflow-hidden">
              <div className="flex items-start justify-between mb-3 pb-2 border-b border-line px-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">The reconciliation</p>
                  <h2 className="text-lg font-serif font-medium text-ink">Variance</h2>
                </div>
                {flagged.length > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-soft text-red text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {flagged.length} flagged
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-soft text-green text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    In balance
                  </span>
                )}
              </div>

              <div className="space-y-3 px-4 pb-4">
                {lines.map((line) => {
                  const status = varianceStatus(line);
                  const width = line.theoretical
                    ? Math.min(100, (Math.abs(line.actual - line.theoretical) / Math.max(line.theoretical, 1)) * 100)
                    : 0;
                  return (
                    <div className="p-3 bg-surface-2 rounded-lg" key={line.ingredient.id}>
                      <div className="flex items-center justify-between">
                        <strong className="text-ink">{line.ingredient.name}</strong>
                        <VariancePill
                          variance={line.variance}
                          theoretical={line.theoretical}
                          unit={line.ingredient.unit}
                          showValue={false}
                        />
                      </div>
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-ink-soft w-16">Theory</span>
                          <span className="flex-1 h-1.5 bg-line/50 rounded-full overflow-hidden">
                            <span
                              className="h-full bg-ink"
                              style={{ width: `${line.theoretical ? 100 : 0}%` }}
                            />
                          </span>
                          <span className="text-xs font-medium text-ink w-12 text-right">
                            {fmt(line.theoretical)} <span className="text-xs text-muted ml-0.5">{unitLabel(line.ingredient.unit)}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-ink-soft w-16">Actual</span>
                          <span className="flex-1 h-1.5 bg-line/50 rounded-full overflow-hidden">
                            <span
                              className={`h-full ${status === "on-target" ? "bg-green" : "bg-accent-dark"}`}
                              style={{
                                width: `${Math.min(100, Math.max(6, line.theoretical ? (line.actual / line.theoretical) * 100 : line.actual ? 100 : 0))}%`,
                              }}
                            />
                          </span>
                          <span className="text-xs font-medium text-ink w-12 text-right">
                            {fmt(line.actual)} <span className="text-xs text-muted ml-0.5">{unitLabel(line.ingredient.unit)}</span>
                          </span>
                        </div>
                      </div>
                      {status !== "on-target" && (
                        <p className={`mt-2 text-xs ${status === "over" ? "text-red" : "text-green"}`}>
                          {status === "over"
                            ? `${fmt(Math.abs(line.variance))} ${unitLabel(line.ingredient.unit)} more left the shelf than the recipes explain${width > 20 ? " — check comps or over-pouring" : ""}.`
                            : `${fmt(Math.abs(line.variance))} ${unitLabel(line.ingredient.unit)} less was used than expected — check the closing count or a missed sale.`}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <label className="px-4 space-y-1">
                <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider block">Shift notes</span>
                <textarea
                  rows={3}
                  placeholder="Comps, spills, deliveries, anything that explains the gap…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
                />
              </label>

              <button
                className="w-full bg-ink text-white py-2 rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors"
                onClick={save}
                disabled={saving || loading}
              >
                {saving
                  ? "Saving…"
                  : savedClosing
                    ? `Update ${shiftShort(shift)} closing`
                    : `Save ${shiftShort(shift)} closing`}
              </button>
              <p className="px-4 pt-2 pb-4 text-xs text-muted text-center">
                Saves a permanent snapshot of this shift's variance.
              </p>
            </div>

            <div className="bg-surface border border-line rounded-lg p-4">
              <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Why variance matters</p>
              <p className="mt-1 text-sm text-muted">
                A gap that keeps showing up on milk but not on coffee usually means
                over-pouring or free drinks. An even gap across both usually means an
                unrecorded sale.
              </p>
            </div>
          </aside>
        </div>
      )}

      {toast && <div className="fixed bottom-4 right-4 z-50 bg-ink text-white px-4 py-2 rounded-lg shadow-lg">{toast}</div>}
    </>
  );
}
