import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import VariancePill from "../components/VariancePill";
import { api } from "../api";
import type { EndingReport, Overview } from "../types";
import {
  fmt,
  formatDate,
  formatDateRange,
  isFlagged,
  reportRange,
  shiftLabel,
  shiftShort,
  todayISO,
  unitLabel,
} from "../lib";
import {
  IconArrowRight,
  IconCheck,
  IconCoffee,
  IconInventory,
  IconMilk,
  IconPlus,
  IconRecipes,
  IconReport,
} from "../components/Icons";

export default function Dashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [report, setReport] = useState<EndingReport | null>(null);
  const [error, setError] = useState("");
  const monthRange = reportRange("month");

  useEffect(() => {
    api
      .overview()
      .then(setOverview)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load overview"));
    api
      .report(monthRange.from, monthRange.to)
      .then(setReport)
      .catch(() => {
        /* the report card is supplementary; the dashboard still works without it */
      });
  }, [monthRange.from, monthRange.to]);

  const latest = overview?.latest;
  const coffeeLine = latest?.lines.find((line) => line.unit === "g");
  const milkLine = latest?.lines.find((line) => line.unit === "ml");
  const flagged = latest?.lines.filter(isFlagged) ?? [];

  return (
    <>
      <PageHeader
        eyebrow={formatDate(todayISO(), "long")}
        title="Your café, reconciled."
        description="Recipes set the expectation. The closing count tells the truth. Everything in between is what this ledger is for."
        actions={
          <Link className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors" to="/inventory">
            <IconPlus size={17} className="mr-2" /> Start today's count
          </Link>
        }
      />

      {error && (
        <div className="bg-red-soft border border-red rounded-lg p-3 flex items-center gap-2">
          {error}
        </div>
      )}

      {!overview ? (
        <div className="bg-surface border border-line rounded-lg h-64 flex items-center justify-center" />
      ) : !latest ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="mb-3 text-accent-soft"><IconInventory size={26} /></span>
          <h2 className="text-lg font-serif font-medium text-ink">Nothing counted yet</h2>
          <p className="mt-1 text-muted text-sm max-w-xs mx-auto">
            Add your drinks and their recipes, then take your first closing count to see
            theoretical versus actual usage.
          </p>
          <div className="mt-4 flex gap-2">
            <Link className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors inline-flex items-center gap-2" to="/recipes">
              <IconRecipes size={17} /> Set up recipes
            </Link>
            <Link className="bg-surface border border-line rounded-lg px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2 hover:text-ink transition-colors" to="/inventory">
              Go to the count sheet
            </Link>
          </div>
        </div>
      ) : (
        <>
          <section className="mb-6">
            <article className="bg-surface border border-line rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Latest closing</p>
                  <h2 className="text-xl font-serif font-medium text-ink">{formatDate(latest.date, "long")}</h2>
                  <p className="mt-0.5 text-sm text-muted">
                    {shiftLabel(latest.shift)} · Prepared by{" "}
                    {latest.prepared_by || "not recorded"}
                  </p>
                </div>
                {flagged.length === 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-soft text-green text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" /> Balanced
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-soft text-red text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-current" /> {flagged.length} to review
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Coffee used</span>
                  <p className="text-3xl font-serif font-medium text-ink">
                    {fmt(coffeeLine?.actual_usage ?? 0)} <span className="text-lg">g</span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted">Theory {fmt(coffeeLine?.theoretical_usage ?? 0)} g</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Milk used</span>
                  <p className="text-3xl font-serif font-medium text-ink">
                    {fmt(milkLine?.actual_usage ?? 0)} <span className="text-lg">ml</span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted">Theory {fmt(milkLine?.theoretical_usage ?? 0)} ml</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Drinks logged</span>
                  <p className="text-3xl font-serif font-medium text-ink">
                    {fmt(latest.sales.reduce((sum, sale) => sum + sale.quantity, 0))}
                    <span className="text-lg">cups</span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{latest.sales.length} menu items sold</p>
                </div>
              </div>

              {latest.notes && (
                <p className="mt-4 text-sm text-muted flex items-center gap-2">
                  <span className="font-medium text-ink">Shift note</span> {latest.notes}
                </p>
              )}

              <div className="mt-6 flex gap-3 flex-wrap">
                <Link className="text-accent hover:underline text-sm font-medium" to={`/history/${latest.id}`}>
                  Open the full reconciliation <IconArrowRight size={15} className="ml-1" />
                </Link>
                <Link className="text-accent hover:underline text-sm font-medium" to="/inventory">
                  Count today <IconArrowRight size={15} className="ml-1" />
                </Link>
              </div>
            </article>

            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <article className="bg-surface border border-line rounded-lg p-4 flex items-center gap-3">
                  <span className="w-8 h-8 rounded bg-surface-2 flex items-center justify-center text-accent"><IconRecipes size={18} /></span>
                  <p className="text-2xl font-serif font-medium text-ink">{overview.counts.beverages}</p>
                  <p className="text-xs text-muted">Beverages on the menu</p>
                </article>
                <article className="bg-surface border border-line rounded-lg p-4 flex items-center gap-3">
                  <span className="w-8 h-8 rounded bg-surface-2 flex items-center justify-center text-accent"><IconCoffee size={18} /></span>
                  <p className="text-2xl font-serif font-medium text-ink">{overview.counts.ingredients}</p>
                  <p className="text-xs text-muted">Ingredients tracked</p>
                </article>
                <article className="bg-surface border border-line rounded-lg p-4 flex items-center gap-3">
                  <span className="w-8 h-8 rounded bg-surface-2 flex items-center justify-center text-accent"><IconInventory size={18} /></span>
                  <p className="text-2xl font-serif font-medium text-ink">{overview.counts.closings}</p>
                  <p className="text-xs text-muted">Shift closings saved</p>
                </article>
                <article className="bg-surface border border-line rounded-lg p-4 flex items-center gap-3">
                  <span className="w-8 h-8 rounded bg-surface-2 flex items-center justify-center text-accent"><IconMilk size={18} /></span>
                  <p className="text-2xl font-serif font-medium text-ink">{flagged.length}</p>
                  <p className="text-xs text-muted">Items outside tolerance</p>
                </article>
              </div>

              <article className="bg-surface border border-line rounded-lg p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">How it reads</p>
                    <h3 className="text-lg font-serif font-medium text-ink">One cappuccino, two truths</h3>
                  </div>
                </div>
                <p className="text-sm text-ink">
                  An 8 oz cappuccino calls for <strong>7 g</strong> of beans and{" "}
                  <strong>150 ml</strong> of milk. If the shelf dropped 14 g and 300 ml
                  against one sale, the variance is{" "}
                  <strong>+7 g / +150 ml</strong> — one drink that never hit the till.
                </p>
              </article>
            </div>
          </section>

          <section className="bg-surface border border-line rounded-lg p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded bg-accent-soft flex items-center justify-center text-accent-dark"><IconReport size={20} /></span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Month to date</p>
                <h2 className="text-lg font-serif font-medium text-ink">Ending report</h2>
                <p className="mt-0.5 text-xs text-muted">
                  {formatDateRange(monthRange.from, monthRange.to)} · consumption,
                  stock movement and every variance in one shareable view.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div>
                <strong className="text-2xl font-serif font-medium text-ink">{report ? fmt(report.closing_count) : "—"}</strong>
                <span className="text-xs text-muted block">shift closes</span>
              </div>
              <div>
                <strong className="text-2xl font-serif font-medium text-ink">{report ? fmt(report.total_cups) : "—"}</strong>
                <span className="text-xs text-muted block">cups sold</span>
              </div>
              <div>
                <strong className={`text-2xl font-serif font-medium ${report?.flagged_lines ? "text-red" : "text-ink-soft"}`}>
                  {report ? fmt(report.flagged_lines) : "—"}
                </strong>
                <span className="text-xs text-muted block">flagged entries</span>
              </div>
              <div>
                <strong className="text-2xl font-serif font-medium text-ink">{report ? fmt(report.lines.length) : "—"}</strong>
                <span className="text-xs text-muted block">stock lines</span>
              </div>
            </div>
            <Link
              className="bg-ink text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors"
              to={`/report?from=${monthRange.from}&to=${monthRange.to}&period=month`}
            >
              Open report <IconArrowRight size={14} className="ml-1" />
            </Link>
          </section>

          <section className="mt-6 bg-surface border border-line rounded-lg overflow-hidden">
            <div className="flex items-start justify-between mb-4 pb-2 border-b border-line px-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Latest closing</p>
                <h2 className="text-lg font-serif font-medium text-ink">Where the stock went</h2>
              </div>
              <Link className="bg-surface border border-line rounded-lg px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-surface-2 hover:text-ink transition-colors" to="/history">
                All closings
              </Link>
            </div>

            <div className="overflow-x-auto px-5 pb-4">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left border-b border-line">
                    <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider">Ingredient</th>
                    <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Theory</th>
                    <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Actual</th>
                    <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Variance</th>
                    <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.lines.map((line) => {
                    const pct = line.theoretical_usage
                      ? (line.variance / line.theoretical_usage) * 100
                      : 0;
                    return (
                      <tr key={line.id} className="border-b border-line/50 hover:bg-surface-2/50 transition-colors">
                        <td className="pb-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${line.unit === "g" ? "bg-green" : "bg-accent-dark"}`}
                            />
                            <div>
                              <strong className="text-ink">{line.ingredient_name}</strong>
                              <span className="ml-0.5 text-xs text-muted">{unitLabel(line.unit)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="pb-3 text-right [font-variant-numeric:tabular-nums]">
                          {fmt(line.theoretical_usage)} <span className="text-xs text-muted">{unitLabel(line.unit)}</span>
                        </td>
                        <td className="pb-3 text-right [font-variant-numeric:tabular-nums]">
                          {fmt(line.actual_usage)} <span className="text-xs text-muted">{unitLabel(line.unit)}</span>
                        </td>
                        <td className="pb-3 text-right">
                          <VariancePill
                            variance={line.variance}
                            theoretical={line.theoretical_usage}
                            unit={line.unit}
                          />
                        </td>
                        <td className="pb-3 text-right [font-variant-numeric:tabular-nums]">
                          <span className={pct > 0 ? "text-red" : pct < 0 ? "text-green" : "text-muted"}>
                            {line.theoretical_usage ? `${pct > 0 ? "+" : ""}${fmt(pct, 1)}%` : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {flagged.length === 0 && (
              <p className="px-5 pt-4 pb-6 text-xs text-green flex items-center gap-1">
                <IconCheck size={16} /> Everything sits inside a 2% tolerance. A clean close.
              </p>
            )}
          </section>

          <section className="mt-6 bg-surface border border-line rounded-lg overflow-hidden">
            <div className="flex items-start justify-between mb-4 pb-2 border-b border-line px-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Recent</p>
                <h2 className="text-lg font-serif font-medium text-ink">Closing log</h2>
              </div>
              <Link className="text-accent hover:underline text-sm font-medium" to="/history">
                View history <IconArrowRight size={15} className="ml-1" />
              </Link>
            </div>
            <ul className="px-5 space-y-2 pb-6">
              {overview.closings.map((closing) => (
                <li key={closing.id}>
                  <Link to={`/history/${closing.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-2 transition-colors text-accent no-underline">
                    <span className="flex flex-col gap-0.5">
                      <strong className="text-ink">{formatDate(closing.date)}</strong>
                      <span className="text-xs text-muted">
                        {shiftShort(closing.shift)}
                        {closing.prepared_by ? ` · ${closing.prepared_by}` : ""} ·{" "}
                        {closing.notes || "No shift note"}
                      </span>
                    </span>
                    {closing.flagged_count > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-soft text-red text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {closing.flagged_count} flagged
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-soft text-green text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        Balanced
                      </span>
                    )}
                    <IconArrowRight size={16} className="ml-2 text-ink-soft" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
