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
          <Link className="btn btn-primary" to="/inventory">
            <IconPlus size={17} /> Start today's count
          </Link>
        }
      />

      {error && <div className="banner banner-error">{error}</div>}

      {!overview ? (
        <div className="card skeleton-card" />
      ) : !latest ? (
        <div className="empty-state">
          <span className="empty-mark"><IconInventory size={26} /></span>
          <h2>Nothing counted yet</h2>
          <p>
            Add your drinks and their recipes, then take your first closing count to see
            theoretical versus actual usage.
          </p>
          <div className="empty-actions">
            <Link className="btn btn-primary" to="/recipes">
              <IconRecipes size={17} /> Set up recipes
            </Link>
            <Link className="btn btn-quiet" to="/inventory">
              Go to the count sheet
            </Link>
          </div>
        </div>
      ) : (
        <>
          <section className="hero-grid">
            <article className="card hero-card">
              <div className="hero-top">
                <div>
                  <p className="eyebrow">Latest closing</p>
                  <h2>{formatDate(latest.date, "long")}</h2>
                  <p className="hero-meta">
                    {shiftLabel(latest.shift)} · Prepared by{" "}
                    {latest.prepared_by || "not recorded"}
                  </p>
                </div>
                {flagged.length === 0 ? (
                  <span className="pill pill-on-target">
                    <span className="pill-dot" /> Balanced
                  </span>
                ) : (
                  <span className="pill pill-over">
                    <span className="pill-dot" /> {flagged.length} to review
                  </span>
                )}
              </div>

              <div className="hero-metrics">
                <div>
                  <span className="metric-label">Coffee used</span>
                  <p className="metric-value numeric">
                    {fmt(coffeeLine?.actual_usage ?? 0)} <small>g</small>
                  </p>
                  <p className="metric-sub">
                    Theory {fmt(coffeeLine?.theoretical_usage ?? 0)} g
                  </p>
                </div>
                <div>
                  <span className="metric-label">Milk used</span>
                  <p className="metric-value numeric">
                    {fmt(milkLine?.actual_usage ?? 0)} <small>ml</small>
                  </p>
                  <p className="metric-sub">Theory {fmt(milkLine?.theoretical_usage ?? 0)} ml</p>
                </div>
                <div>
                  <span className="metric-label">Drinks logged</span>
                  <p className="metric-value numeric">
                    {fmt(latest.sales.reduce((sum, sale) => sum + sale.quantity, 0))}
                    <small> cups</small>
                  </p>
                  <p className="metric-sub">{latest.sales.length} menu items sold</p>
                </div>
              </div>

              {latest.notes && (
                <p className="hero-note">
                  <span>Shift note</span> {latest.notes}
                </p>
              )}

              <div className="hero-foot">
                <Link className="text-link" to={`/history/${latest.id}`}>
                  Open the full reconciliation <IconArrowRight size={15} />
                </Link>
                <Link className="text-link" to="/inventory">
                  Count today <IconArrowRight size={15} />
                </Link>
              </div>
            </article>

            <div className="stack">
              <div className="stat-grid">
                <article className="card stat-card">
                  <span className="stat-icon"><IconRecipes size={18} /></span>
                  <p className="stat-number numeric">{overview.counts.beverages}</p>
                  <p className="stat-label">Beverages on the menu</p>
                </article>
                <article className="card stat-card">
                  <span className="stat-icon"><IconCoffee size={18} /></span>
                  <p className="stat-number numeric">{overview.counts.ingredients}</p>
                  <p className="stat-label">Ingredients tracked</p>
                </article>
                <article className="card stat-card">
                  <span className="stat-icon"><IconInventory size={18} /></span>
                  <p className="stat-number numeric">{overview.counts.closings}</p>
                  <p className="stat-label">Shift closings saved</p>
                </article>
                <article className="card stat-card">
                  <span className="stat-icon"><IconMilk size={18} /></span>
                  <p className="stat-number numeric">{flagged.length}</p>
                  <p className="stat-label">Items outside tolerance</p>
                </article>
              </div>

              <article className="card explainer-card">
                <div className="explainer-head">
                  <p className="eyebrow">How it reads</p>
                  <h3>One cappuccino, two truths</h3>
                </div>
                <p>
                  An 8 oz cappuccino calls for <strong>7 g</strong> of beans and{" "}
                  <strong>150 ml</strong> of milk. If the shelf dropped 14 g and 300 ml
                  against one sale, the variance is{" "}
                  <strong>+7 g / +150 ml</strong> — one drink that never hit the till.
                </p>
              </article>
            </div>
          </section>

          <section className="card report-preview">
            <div className="report-preview-copy">
              <span className="report-preview-icon"><IconReport size={20} /></span>
              <div>
                <p className="eyebrow">Month to date</p>
                <h2>Ending report</h2>
                <p className="muted small">
                  {formatDateRange(monthRange.from, monthRange.to)} · consumption,
                  stock movement and every variance in one shareable view.
                </p>
              </div>
            </div>
            <div className="report-preview-stats">
              <div>
                <strong className="numeric">{report ? fmt(report.closing_count) : "—"}</strong>
                <span>shift closes</span>
              </div>
              <div>
                <strong className="numeric">{report ? fmt(report.total_cups) : "—"}</strong>
                <span>cups sold</span>
              </div>
              <div>
                <strong className={`numeric${report?.flagged_lines ? " text-over" : ""}`}>
                  {report ? fmt(report.flagged_lines) : "—"}
                </strong>
                <span>flagged entries</span>
              </div>
              <div>
                <strong className="numeric">{report ? fmt(report.lines.length) : "—"}</strong>
                <span>stock lines</span>
              </div>
            </div>
            <Link
              className="btn btn-primary btn-sm report-preview-link"
              to={`/report?from=${monthRange.from}&to=${monthRange.to}&period=month`}
            >
              Open report <IconArrowRight size={14} />
            </Link>
          </section>

          <section className="card">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Latest closing</p>
                <h2>Where the stock went</h2>
              </div>
              <Link className="btn btn-quiet btn-sm" to="/history">
                All closings
              </Link>
            </div>

            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th className="right">Theory</th>
                    <th className="right">Actual</th>
                    <th className="right">Variance</th>
                    <th className="right">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.lines.map((line) => {
                    const pct = line.theoretical_usage
                      ? (line.variance / line.theoretical_usage) * 100
                      : 0;
                    return (
                      <tr key={line.id}>
                        <td>
                          <div className="ingredient-cell">
                            <span className={`ingredient-dot ${line.unit === "g" ? "coffee" : "milk"}`} />
                            <div>
                              <strong>{line.ingredient_name}</strong>
                              <small>{unitLabel(line.unit)}</small>
                            </div>
                          </div>
                        </td>
                        <td className="right numeric">
                          {fmt(line.theoretical_usage)} <small>{unitLabel(line.unit)}</small>
                        </td>
                        <td className="right numeric">
                          {fmt(line.actual_usage)} <small>{unitLabel(line.unit)}</small>
                        </td>
                        <td className="right">
                          <VariancePill
                            variance={line.variance}
                            theoretical={line.theoretical_usage}
                            unit={line.unit}
                          />
                        </td>
                        <td className="right numeric">
                          <span className={pct > 0 ? "text-over" : pct < 0 ? "text-under" : "muted"}>
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
              <p className="balanced-note">
                <IconCheck size={16} /> Everything sits inside a 2% tolerance. A clean close.
              </p>
            )}
          </section>

          <section className="card">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Recent</p>
                <h2>Closing log</h2>
              </div>
              <Link className="text-link" to="/history">
                View history <IconArrowRight size={15} />
              </Link>
            </div>
            <ul className="closing-list">
              {overview.closings.map((closing) => (
                <li key={closing.id}>
                  <Link to={`/history/${closing.id}`} className="closing-row">
                    <span className="closing-date">
                      <strong>{formatDate(closing.date)}</strong>
                      <small>
                        {shiftShort(closing.shift)}
                        {closing.prepared_by ? ` · ${closing.prepared_by}` : ""} ·{" "}
                        {closing.notes || "No shift note"}
                      </small>
                    </span>
                    {closing.flagged_count > 0 ? (
                      <span className="pill pill-over">
                        <span className="pill-dot" />
                        {closing.flagged_count} flagged
                      </span>
                    ) : (
                      <span className="pill pill-on-target">
                        <span className="pill-dot" />
                        Balanced
                      </span>
                    )}
                    <IconArrowRight size={16} className="row-arrow" />
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
