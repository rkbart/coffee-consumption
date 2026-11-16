import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import VariancePill from "../components/VariancePill";
import { api } from "../api";
import type { EndingReport, ReportPeriod } from "../types";
import {
  fmt,
  formatDate,
  formatDateRange,
  reportRange,
  shiftLabel,
  todayISO,
  unitLabel,
} from "../lib";
import {
  IconInventory,
  IconPrinter,
  IconReport,
  IconShare,
} from "../components/Icons";

const PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "last-week", label: "Last week" },
  { id: "month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "year", label: "This year" },
  { id: "ytd", label: "Year to date" },
  { id: "last-30", label: "Last 30 days" },
  { id: "custom", label: "Custom" },
];

const isISODate = (value: string | null): value is string =>
  Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

const isReportPeriod = (value: string | null): value is ReportPeriod =>
  PERIODS.some((period) => period.id === value);

const timestamp = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function Report() {
  const [searchParams, setSearchParams] = useSearchParams();
  const monthRange = reportRange("month");
  const today = todayISO();

  const initialPeriod = isReportPeriod(searchParams.get("period"))
    ? (searchParams.get("period") as ReportPeriod)
    : searchParams.get("from")
      ? "custom"
      : "month";
  const initialRange = reportRange(initialPeriod === "custom" ? "month" : initialPeriod);
  const initialFrom = isISODate(searchParams.get("from"))
    ? (searchParams.get("from") as string)
    : initialRange.from;
  const initialTo = isISODate(searchParams.get("to"))
    ? (searchParams.get("to") as string)
    : initialRange.to;

  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [period, setPeriod] = useState<ReportPeriod>(initialPeriod);
  const [report, setReport] = useState<EndingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shareLabel, setShareLabel] = useState("Copy link");

  useEffect(() => {
    const next = new URLSearchParams({ from, to, period });
    setSearchParams(next, { replace: true });
  }, [from, to, period, setSearchParams]);

  useEffect(() => {
    if (!isISODate(from) || !isISODate(to)) {
      setError("Choose a valid start and end date.");
      setReport(null);
      setLoading(false);
      return;
    }
    if (from > to) {
      setError("The start date must be on or before the end date.");
      setReport(null);
      setLoading(false);
      return;
    }

    let ignore = false;
    setLoading(true);
    setError("");
    api
      .report(from, to)
      .then((next) => {
        if (!ignore) setReport(next);
      })
      .catch((err) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Could not load the report");
          setReport(null);
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [from, to]);

  useEffect(() => {
    if (shareLabel === "Copy link") return;
    const timer = setTimeout(() => setShareLabel("Copy link"), 2200);
    return () => clearTimeout(timer);
  }, [shareLabel]);

  const applyPeriod = (next: ReportPeriod) => {
    setPeriod(next);
    if (next === "custom") return;
    const range = reportRange(next);
    setFrom(range.from);
    setTo(range.to);
  };

  const setDate = (side: "from" | "to", value: string) => {
    if (!value) return;
    setPeriod("custom");
    if (side === "from") setFrom(value);
    else setTo(value);
  };

  const share = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("from", from);
    url.searchParams.set("to", to);
    url.searchParams.set("period", period);
    try {
      await navigator.clipboard.writeText(url.toString());
      setShareLabel("Link copied");
    } catch {
      window.prompt("Copy this report link", url.toString());
    }
  };

  const sortedLines = useMemo(
    () =>
      [...(report?.lines ?? [])].sort(
        (a, b) =>
          b.flagged_closes - a.flagged_closes ||
          Math.abs(b.variance_pct ?? 0) - Math.abs(a.variance_pct ?? 0) ||
          a.name.localeCompare(b.name),
      ),
    [report],
  );

  const empty = report && report.closing_count === 0;

  return (
    <div className="report-page">
      <div className="print-only print-masthead">
        <div>
          <strong>Brew Ledger</strong>
          <span>Ending report · consumption &amp; variance</span>
        </div>
        <div>
          <strong>{formatDateRange(from, to)}</strong>
          <span>{report ? `Generated ${timestamp(report.generated_at)}` : ""}</span>
        </div>
      </div>

      <div className="no-print">
        <PageHeader
          eyebrow="The ending report"
          title="Consumption &amp; variance"
          description="One clean period report for the owner or manager: stock movement, what the recipes expected, what actually left the shelf, and every closing note."
          actions={
            <>
              <button
                className="btn btn-quiet"
                onClick={share}
                disabled={!report}
                title="Copy a link to this exact date range"
              >
                <IconShare size={16} /> {shareLabel}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => window.print()}
                disabled={!report || loading}
              >
                <IconPrinter size={16} /> Print report
              </button>
            </>
          }
        />
      </div>

      <section className="card report-filters no-print">
        <div className="report-presets" role="group" aria-label="Report period">
          {PERIODS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`preset-btn${period === option.id ? " active" : ""}`}
              onClick={() => applyPeriod(option.id)}
              aria-pressed={period === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="report-dates">
          <label className="report-date-field">
            <span>From</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setDate("from", event.target.value)}
            />
          </label>
          <span className="date-dash" aria-hidden="true">→</span>
          <label className="report-date-field">
            <span>To</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setDate("to", event.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={() => {
              setFrom(monthRange.from);
              setTo(today);
              setPeriod("month");
            }}
          >
            Reset to month
          </button>
        </div>
      </section>

      {error && <div className="banner banner-error">{error}</div>}

      {!report && loading ? (
        <div className="card skeleton-card report-skeleton" />
      ) : report ? (
        <article className="card report-sheet" aria-busy={loading}>
          <header className="report-heading">
            <div>
              <p className="eyebrow">Ending report</p>
              <h2>{formatDateRange(report.from, report.to)}</h2>
              <p className="muted">
                {report.closing_count === 0
                  ? "No closings saved in this period."
                  : `${report.closing_count} closing${report.closing_count === 1 ? "" : "s"} from ${formatDate(report.first_date ?? report.from)} to ${formatDate(report.last_date ?? report.to)}`}
                {report.generated_at ? ` · generated ${timestamp(report.generated_at)}` : ""}
              </p>
            </div>
            {report.flagged_lines > 0 ? (
              <span className="pill pill-over">
                <span className="pill-dot" /> {report.flagged_lines} flagged
              </span>
            ) : report.closing_count > 0 ? (
              <span className="pill pill-on-target">
                <span className="pill-dot" /> Balanced
              </span>
            ) : null}
          </header>

          {empty ? (
            <div className="empty-state report-empty">
              <span className="empty-mark"><IconReport size={26} /></span>
              <h2>No closings in this range</h2>
              <p>Widen the date range or save a daily closing to start the report.</p>
              <div className="empty-actions no-print">
                <Link className="btn btn-primary" to="/inventory">
                  <IconInventory size={16} /> Go to the count sheet
                </Link>
                <button
                  className="btn btn-quiet"
                  onClick={() => {
                    const range = reportRange("last-30");
                    setFrom(range.from);
                    setTo(range.to);
                    setPeriod("last-30");
                  }}
                >
                  Show the last 30 days
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="report-summary-grid">
                <div className="report-summary-item">
                  <span className="mini-label">Shift closes</span>
                  <strong className="numeric">{fmt(report.closing_count)}</strong>
                  <span>shifts reconciled</span>
                </div>
                <div className="report-summary-item">
                  <span className="mini-label">Cups sold</span>
                  <strong className="numeric">{fmt(report.total_cups)}</strong>
                  <span>across the period</span>
                </div>
                <div className="report-summary-item">
                  <span className="mini-label">Flagged entries</span>
                  <strong className={`numeric${report.flagged_lines ? " text-over" : ""}`}>
                    {fmt(report.flagged_lines)}
                  </strong>
                  <span>{report.flagged_closes} closings affected</span>
                </div>
                <div className="report-summary-item">
                  <span className="mini-label">Ingredients tracked</span>
                  <strong className="numeric">{fmt(report.lines.length)}</strong>
                  <span>stock lines in the report</span>
                </div>
              </div>

              <section className="report-section">
                <div className="report-section-head">
                  <div>
                    <h3>Stock movement &amp; variance</h3>
                    <p className="muted small">
                      Opening is the first closing in the range; ending stock is the last.
                      Deliveries, waste and usage are summed across every closing.
                    </p>
                  </div>
                </div>

                <div className="table-scroll">
                  <table className="data-table report-table">
                    <thead>
                      <tr>
                        <th>Ingredient</th>
                        <th className="right">Opening</th>
                        <th className="right">Deliv.</th>
                        <th className="right">Waste</th>
                        <th className="right">Ending</th>
                        <th className="right">Actual</th>
                        <th className="right">Theory</th>
                        <th className="right">Variance</th>
                        <th className="right">Gap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLines.map((line) => (
                        <tr
                          key={`${line.ingredient_id}-${line.name}-${line.unit}`}
                          className={line.flagged_closes ? "report-flagged-row" : ""}
                        >
                          <td>
                            <strong>{line.name}</strong>
                            <small className="unit-inline">
                              {" "}
                              {unitLabel(line.unit)} · {line.closing_count} shift
                              {line.closing_count === 1 ? "" : "s"}
                            </small>
                          </td>
                          <td className="right numeric">{fmt(line.opening)}</td>
                          <td className="right numeric">{fmt(line.deliveries)}</td>
                          <td className="right numeric">{fmt(line.waste)}</td>
                          <td className="right numeric">{fmt(line.ending_stock)}</td>
                          <td className="right numeric strong">{fmt(line.actual_usage)}</td>
                          <td className="right numeric">{fmt(line.theoretical_usage)}</td>
                          <td className="right">
                            <VariancePill
                              variance={line.variance}
                              theoretical={line.theoretical_usage}
                              unit={line.unit}
                            />
                          </td>
                          <td className="right numeric">
                            <span
                              className={
                                (line.variance_pct ?? 0) > 0
                                  ? "text-over"
                                  : (line.variance_pct ?? 0) < 0
                                    ? "text-under"
                                    : "muted"
                              }
                            >
                              {line.variance_pct === null
                                ? "—"
                                : `${line.variance_pct > 0 ? "+" : ""}${fmt(line.variance_pct, 1)}%`}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="report-formula">
                  Actual usage = opening + deliveries − waste − ending stock. Variance =
                  actual − theoretical. A positive gap is stock that left without a
                  recorded sale; a negative gap is less used than the recipes expected.
                </p>
              </section>

              <section className="report-section">
                <div className="report-section-head">
                  <div>
                    <h3>Shift closes</h3>
                    <p className="muted small">
                      Every saved shift in this period and who prepared it.
                    </p>
                  </div>
                  <span className="count-chip">{report.closings.length}</span>
                </div>
                <div className="table-scroll">
                  <table className="data-table report-shifts-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Shift</th>
                        <th>Prepared by</th>
                        <th className="right">Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.closings.map((closing) => (
                        <tr key={closing.id}>
                          <td>{formatDate(closing.date)}</td>
                          <td>{shiftLabel(closing.shift)}</td>
                          <td>
                            {closing.prepared_by ? (
                              <strong>{closing.prepared_by}</strong>
                            ) : (
                              <span className="muted">Not recorded</span>
                            )}
                          </td>
                          <td className="right">
                            {closing.flagged_count > 0 ? (
                              <span className="text-over">
                                {closing.flagged_count} flagged
                              </span>
                            ) : (
                              <span className="muted">Balanced</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="report-columns">
                <section className="report-section">
                  <div className="report-section-head">
                    <div>
                      <h3>Drinks sold</h3>
                      <p className="muted small">POS and manual cups across the period.</p>
                    </div>
                    <span className="count-chip">{fmt(report.total_cups)} cups</span>
                  </div>
                  {report.sales.length === 0 ? (
                    <p className="muted small">No drinks were recorded in this range.</p>
                  ) : (
                    <table className="data-table report-sales-table">
                      <thead>
                        <tr>
                          <th>Beverage</th>
                          <th>Size</th>
                          <th className="right">Cups</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.sales.map((sale) => (
                          <tr key={`${sale.product_name}-${sale.size_label}`}>
                            <td>{sale.product_name}</td>
                            <td>{sale.size_label || "—"}</td>
                            <td className="right numeric strong">{fmt(sale.quantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>

                <section className="report-section">
                  <div className="report-section-head">
                    <div>
                      <h3>Shift notes</h3>
                      <p className="muted small">What the team recorded at closing.</p>
                    </div>
                    <span className="count-chip">{report.notes.length}</span>
                  </div>
                  {report.notes.length === 0 ? (
                    <p className="muted small">No notes were left in this range.</p>
                  ) : (
                    <ul className="report-notes">
                      {report.notes.map((note) => (
                        <li key={`${note.date}-${note.shift}`}>
                          <strong>
                            {formatDate(note.date)} · {shiftLabel(note.shift)}
                          </strong>
                          {note.prepared_by && (
                            <small className="report-note-by">
                              Prepared by {note.prepared_by}
                            </small>
                          )}
                          <span>{note.notes}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <footer className="report-foot">
                <span>
                  {report.closing_count} shift close{report.closing_count === 1 ? "" : "s"} ·
                  saved snapshots only
                </span>
                <span className="print-only">Brew Ledger · ending report</span>
              </footer>
            </>
          )}
        </article>
      ) : null}
    </div>
  );
}
