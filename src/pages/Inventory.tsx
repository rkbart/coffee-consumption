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
          <div className="date-switcher">
            <button
              className="icon-btn"
              aria-label="Previous day"
              onClick={() => setDate(shiftDate(date, -1))}
            >
              <IconArrowLeft size={17} />
            </button>
            <label className="date-field">
              <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
              <span>{formatDate(date)}</span>
            </label>
            <button
              className="icon-btn"
              aria-label="Next day"
              onClick={() => setDate(shiftDate(date, 1))}
            >
              <IconArrowRight size={17} />
            </button>
          </div>
        }
      />

      <section className="card shift-panel">
        <div className="shift-panel-main">
          <p className="mini-label">Shift</p>
          <div className="shift-tabs" role="tablist" aria-label="Count shift">
            {SHIFTS.map((option) => {
              const saved = dayShifts.find((row) => row.shift === option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={shift === option.id}
                  className={`shift-tab${shift === option.id ? " active" : ""}`}
                  onClick={() => setShift(option.id)}
                >
                  <span className="shift-short">{option.short}</span>
                  <span className="shift-copy">
                    <strong>{option.label}</strong>
                    <small>{option.time}</small>
                  </span>
                  {saved && (
                    <span className="shift-saved" title={`Saved by ${saved.prepared_by || "unnamed"}`}>
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <label className="field prepared-field">
          <span>Prepared by</span>
          <input
            value={preparedBy}
            onChange={(event) => setPreparedBy(event.target.value)}
            placeholder="Name or initials on this shift"
            maxLength={80}
          />
          <small className="field-hint">Shown beside this shift in history and reports.</small>
        </label>
      </section>

      {error && <div className="banner banner-error">{error}</div>}
      {carriedFrom && !savedClosing && (
        <div className="banner banner-info">
          <IconSpark size={17} />
          Opening stock carried over from the {formatDate(carriedFrom)}
          {carriedShift ? ` ${shiftShort(carriedShift)}` : ""} close. Adjust it if the
          shelf count disagreed.
        </div>
      )}
      {savedClosing && (
        <div className="banner banner-success">
          <IconCheck size={16} />
          The {shiftLabel(shift)} count is closed. Any change you save replaces this
          shift's snapshot.
        </div>
      )}

      {loading ? (
        <div className="card skeleton-card" />
      ) : (
        <div className="count-layout">
          <section className="stack">
            <div className="summary-strip">
              <div className="summary-tile">
                <span className="summary-icon coffee"><IconCoffee size={20} /></span>
                <div>
                  <p className="mini-label">Coffee usage</p>
                  <p className="summary-value numeric">
                    {fmt(coffee.actual)} <small>g</small>
                    <span className="summary-vs">actual</span>
                  </p>
                  <p className="summary-sub">
                    Theory {fmt(coffee.theoretical)} g ·{" "}
                    <span className={coffee.variance === 0 ? "" : coffee.variance > 0 ? "text-over" : "text-under"}>
                      {fmtSigned(coffee.variance)} g
                    </span>
                  </p>
                </div>
              </div>
              <div className="summary-tile">
                <span className="summary-icon milk"><IconMilk size={20} /></span>
                <div>
                  <p className="mini-label">Milk usage</p>
                  <p className="summary-value numeric">
                    {fmt(milk.actual)} <small>ml</small>
                    <span className="summary-vs">actual</span>
                  </p>
                  <p className="summary-sub">
                    Theory {fmt(milk.theoretical)} ml ·{" "}
                    <span className={milk.variance === 0 ? "" : milk.variance > 0 ? "text-over" : "text-under"}>
                      {fmtSigned(milk.variance)} ml
                    </span>
                  </p>
                </div>
              </div>
              <div className="summary-tile">
                <span className="summary-icon neutral"><IconCheck size={20} /></span>
                <div>
                  <p className="mini-label">Drinks logged</p>
                  <p className="summary-value numeric">
                    {fmt(totalDrinks)} <small>cups</small>
                  </p>
                  <p className="summary-sub">{products.length} beverages on the menu</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Inventory</p>
                  <h2>Count sheet · {shiftShort(shift)}</h2>
                </div>
                <span className="muted small">All weights in g · liquids in ml</span>
              </div>

              <div className="table-scroll">
                <table className="data-table count-table">
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      <th>Opening</th>
                      <th>Deliveries</th>
                      <th>Waste</th>
                      <th>Closing</th>
                      <th className="right">Actual use</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.ingredient.id}>
                        <td>
                          <div className="ingredient-cell">
                            <span className={`ingredient-dot ${line.ingredient.unit === "g" ? "coffee" : "milk"}`} />
                            <div>
                              <strong>{line.ingredient.name}</strong>
                              <small>{unitLabel(line.ingredient.unit)}</small>
                            </div>
                          </div>
                        </td>
                        {(["opening", "deliveries", "waste", "closing"] as const).map((field) => (
                          <td key={field}>
                            <input
                              className="cell-input numeric"
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
                        <td className="right">
                          <span className="actual-value numeric">{fmt(line.actual)}</span>
                          <span className="unit-inline">{unitLabel(line.ingredient.unit)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="formula-note">
                Actual usage = opening + deliveries − waste − closing. The ending count is
                the one to take at the last minute of the shift.
              </p>
            </div>

            <div className="card">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Till</p>
                  <h2>Drinks sold this shift</h2>
                </div>
                <span className="count-chip">{totalDrinks} cups</span>
              </div>
              <p className="muted small panel-note">
                Log cups that did not go through the POS too — comps, staff drinks,
                remakes.
              </p>

              <div className="list-toolbar sale-filter-row">
                <SearchField
                  value={saleSearch}
                  onChange={setSaleSearch}
                  placeholder="Search drinks, groups or ingredients…"
                  label="Search drinks sold this shift"
                />
                <label className="menu-filter">
                  <span>Menu group</span>
                  <select
                    value={menuGroup}
                    onChange={(event) => setMenuGroup(event.target.value)}
                  >
                    <option value="all">All menu groups</option>
                    {menuGroups.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="search-summary" aria-live="polite">
                  {saleQuery
                    ? `${visibleProducts.length} result${visibleProducts.length === 1 ? "" : "s"} for “${debouncedSaleSearch.trim()}”`
                    : menuGroup === "all"
                      ? `${products.length} beverages`
                      : `${visibleProducts.length} of ${products.length} beverages`}
                </span>
              </div>

              {visibleProducts.length === 0 ? (
                <div className="sales-empty">
                  <p className="muted small">
                    {saleQuery
                      ? `No drinks match “${debouncedSaleSearch.trim()}”.`
                      : `No beverages are in ${menuGroup} yet.`}
                  </p>
                  {(saleQuery || menuGroup !== "all") && (
                    <button
                      type="button"
                      className="btn btn-quiet btn-sm"
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
                  <div className="sales-groups">
                    {Object.entries(productGroups).map(([category, items]) => (
                      <div key={category} className="sales-group">
                        <p className="mini-label">{category}</p>
                        {items.map((product) => (
                          <div className="sale-row" key={product.id}>
                            <div className="sale-name">
                              <strong>{product.name}</strong>
                              <small>{product.size_label || "—"}</small>
                            </div>
                            <div className="sale-recipe">
                              {product.recipe.map((line) => (
                                <span key={line.id}>
                                  {fmt(line.qty, 1)} {unitLabel(line.unit)} {line.ingredient_name.split(" ")[0]}
                                </span>
                              ))}
                            </div>
                            <div className="stepper">
                              <button
                                type="button"
                                onClick={() => stepSale(product.id, -1)}
                                aria-label={`Decrease ${product.name}`}
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min="0"
                                className="numeric"
                                placeholder="0"
                                value={salesDrafts[product.id] ?? ""}
                                onChange={(e) => setSale(product.id, e.target.value)}
                                aria-label={`${product.name} units sold`}
                              />
                              <button
                                type="button"
                                onClick={() => stepSale(product.id, 1)}
                                aria-label={`Increase ${product.name}`}
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

          <aside className="stack count-aside">
            <div className="card variance-card">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">The reconciliation</p>
                  <h2>Variance</h2>
                </div>
                {flagged.length > 0 ? (
                  <span className="pill pill-over">
                    <span className="pill-dot" />
                    {flagged.length} flagged
                  </span>
                ) : (
                  <span className="pill pill-on-target">
                    <span className="pill-dot" />
                    In balance
                  </span>
                )}
              </div>

              <div className="variance-list">
                {lines.map((line) => {
                  const status = varianceStatus(line);
                  const width = line.theoretical
                    ? Math.min(100, (Math.abs(line.actual - line.theoretical) / Math.max(line.theoretical, 1)) * 100)
                    : 0;
                  return (
                    <div className="variance-item" key={line.ingredient.id}>
                      <div className="variance-item-head">
                        <strong>{line.ingredient.name}</strong>
                        <VariancePill
                          variance={line.variance}
                          theoretical={line.theoretical}
                          unit={line.ingredient.unit}
                          showValue={false}
                        />
                      </div>
                      <div className="compare">
                        <div className="compare-row">
                          <span className="compare-label">Theory</span>
                          <span className="compare-track">
                            <span
                              className="compare-fill theory"
                              style={{ width: `${line.theoretical ? 100 : 0}%` }}
                            />
                          </span>
                          <span className="compare-num numeric">
                            {fmt(line.theoretical)} <small>{unitLabel(line.ingredient.unit)}</small>
                          </span>
                        </div>
                        <div className="compare-row">
                          <span className="compare-label">Actual</span>
                          <span className="compare-track">
                            <span
                              className={`compare-fill ${status === "on-target" ? "target" : "actual"}`}
                              style={{
                                width: `${Math.min(100, Math.max(6, line.theoretical ? (line.actual / line.theoretical) * 100 : line.actual ? 100 : 0))}%`,
                              }}
                            />
                          </span>
                          <span className="compare-num numeric">
                            {fmt(line.actual)} <small>{unitLabel(line.ingredient.unit)}</small>
                          </span>
                        </div>
                      </div>
                      {status !== "on-target" && (
                        <p className={`variance-note ${status}`}>
                          {status === "over"
                            ? `${fmt(Math.abs(line.variance))} ${unitLabel(line.ingredient.unit)} more left the shelf than the recipes explain${width > 20 ? " — check comps or over-pouring" : ""}.`
                            : `${fmt(Math.abs(line.variance))} ${unitLabel(line.ingredient.unit)} less was used than expected — check the closing count or a missed sale.`}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <label className="field notes-field">
                <span>Shift notes</span>
                <textarea
                  rows={3}
                  placeholder="Comps, spills, deliveries, anything that explains the gap…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>

              <button className="btn btn-primary btn-block" onClick={save} disabled={saving || loading}>
                {saving
                  ? "Saving…"
                  : savedClosing
                    ? `Update ${shiftShort(shift)} closing`
                    : `Save ${shiftShort(shift)} closing`}
              </button>
              <p className="muted small center">
                Saves a permanent snapshot of this shift's variance.
              </p>
            </div>

            <div className="card explainer">
              <p className="mini-label">Why variance matters</p>
              <p>
                A gap that keeps showing up on milk but not on coffee usually means
                over-pouring or free drinks. An even gap across both usually means an
                unrecorded sale.
              </p>
            </div>
          </aside>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
