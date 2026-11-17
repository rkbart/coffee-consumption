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
    <div>
      <div className="print:block hidden">
        <div className="flex items-start justify-between mb-6">
          <div>
            <strong className="text-lg font-serif font-medium text-ink">Brew Ledger</strong>
            <span className="text-muted">Ending report · consumption &amp; variance</span>
          </div>
          <div>
            <strong className="text-ink">{formatDateRange(from, to)}</strong>
            <span className="text-muted block">
              {report ? `Generated ${timestamp(report.generated_at)}` : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="print:hidden">
        <PageHeader
          eyebrow="The ending report"
          title="Consumption &amp; variance"
          description="One clean period report for the owner or manager: stock movement, what the recipes expected, what actually left the shelf, and every closing note."
          actions={
            <>
              <button
                type="button"
                className="bg-surface border border-line rounded-lg px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2 hover:text-ink transition-colors disabled:opacity-50 disabled:pointer-events-none"
                onClick={share}
                disabled={!report}
                title="Copy a link to this exact date range"
              >
                <IconShare size={16} className="mr-2" /> {shareLabel}
              </button>
              <button
                type="button"
                className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:pointer-events-none"
                onClick={() => window.print()}
                disabled={!report || loading}
              >
                <IconPrinter size={16} className="mr-2" /> Print report
              </button>
            </>
          }
        />
      </div>

      <section className="bg-surface border border-line rounded-lg p-5 print:hidden">
        <div className="flex gap-1 flex-wrap" role="group" aria-label="Report period">
          {PERIODS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                period === option.id
                  ? "bg-accent-soft text-accent-dark"
                  : "text-ink-soft hover:bg-surface-2"
              }`}
              onClick={() => applyPeriod(option.id)}
              aria-pressed={period === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider block">From</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setDate("from", event.target.value)}
              className="bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
            />
          </label>
          <span className="text-muted mx-1" aria-hidden="true">→</span>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider block">To</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setDate("to", event.target.value)}
              className="bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
            />
          </label>
          <button
            type="button"
            className="px-3 py-1.5 text-xs font-medium bg-surface border border-line rounded-lg text-ink-soft hover:bg-surface-2 hover:text-ink transition-colors"
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

      {error && (
        <div className="bg-red-soft border border-red rounded-lg p-3">{error}</div>
      )}

      {!report && loading ? (
        <div className="bg-surface border border-line rounded-lg h-96 flex items-center justify-center" />
      ) : report ? (
        <article className="bg-surface border border-line rounded-lg overflow-hidden" aria-busy={loading}>
          <header className="px-6 py-5 border-b border-line flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Ending report</p>
              <h2 className="text-lg font-serif font-medium text-ink">
                {formatDateRange(report.from, report.to)}
              </h2>
              <p className="mt-0.5 text-sm text-muted">
                {report.closing_count === 0
                  ? "No closings saved in this period."
                  : `${report.closing_count} closing${report.closing_count === 1 ? "" : "s"} from ${formatDate(report.first_date ?? report.from)} to ${formatDate(report.last_date ?? report.to)}`}
                {report.generated_at ? ` · generated ${timestamp(report.generated_at)}` : ""}
              </p>
            </div>
            {report.flagged_lines > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-soft text-red text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {report.flagged_lines} flagged
              </span>
            ) : report.closing_count > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-soft text-green text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                Balanced
              </span>
            ) : null}
          </header>

          {empty ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="mb-3 text-accent-soft"><IconReport size={26} /></span>
              <h2 className="text-lg font-serif font-medium text-ink">No closings in this range</h2>
              <p className="mt-1 text-muted text-sm max-w-xs mx-auto">
                Widen the date range or save a daily closing to start the report.
              </p>
              <div className="mt-4 flex gap-2 print:hidden">
                <Link className="bg-ink text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors inline-flex items-center gap-2" to="/inventory">
                  <IconInventory size={16} /> Go to the count sheet
                </Link>
                <button
                  type="button"
                  className="bg-surface border border-line rounded-lg px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2 hover:text-ink transition-colors print:hidden"
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-6">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Shift closes</span>
                  <strong className="text-lg font-serif font-medium text-ink">{fmt(report.closing_count)}</strong>
                  <span className="text-xs text-muted">shifts reconciled</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Cups sold</span>
                  <strong className="text-lg font-serif font-medium text-ink">{fmt(report.total_cups)}</strong>
                  <span className="text-xs text-muted">across the period</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Flagged entries</span>
                  <strong className={`text-lg font-serif font-medium ${report.flagged_lines ? "text-red" : "text-ink-soft"}`}>
                    {fmt(report.flagged_lines)}
                  </strong>
                  <span className="text-xs text-muted">{report.flagged_closes} closings affected</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Ingredients tracked</span>
                  <strong className="text-lg font-serif font-medium text-ink">{fmt(report.lines.length)}</strong>
                  <span className="text-xs text-muted">stock lines in the report</span>
                </div>
              </div>

              <section className="border-t border-line px-6 py-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-serif font-medium text-ink">Stock movement &amp; variance</h3>
                    <p className="mt-0.5 text-xs text-muted">
                      Opening is the first closing in the range; ending stock is the last.
                      Deliveries, waste and usage are summed across every closing.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="text-left border-b border-line">
                        <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider">Ingredient</th>
                        <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Opening</th>
                        <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Deliv.</th>
                        <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Waste</th>
                        <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Ending</th>
                        <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Actual</th>
                        <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Theory</th>
                        <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Variance</th>
                        <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Gap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedLines.map((line) => (
                        <tr
                          key={`${line.ingredient_id}-${line.name}-${line.unit}`}
                          className={line.flagged_closes ? "bg-red-soft/30" : ""}
                        >
                          <td className="pb-3">
                            <strong className="text-ink">{line.name}</strong>
                            <span className="ml-0.5 text-xs text-muted">
                              {unitLabel(line.unit)} · {line.closing_count} shift
                              {line.closing_count === 1 ? "" : "s"}
                            </span>
                          </td>
                          <td className="pb-3 text-right [font-variant-numeric:tabular-nums]">{fmt(line.opening)}</td>
                          <td className="pb-3 text-right [font-variant-numeric:tabular-nums]">{fmt(line.deliveries)}</td>
                          <td className="pb-3 text-right [font-variant-numeric:tabular-nums]">{fmt(line.waste)}</td>
                          <td className="pb-3 text-right [font-variant-numeric:tabular-nums]">{fmt(line.ending_stock)}</td>
                          <td className="pb-3 text-right [font-variant-numeric:tabular-nums] font-medium text-ink">{fmt(line.actual_usage)}</td>
                          <td className="pb-3 text-right [font-variant-numeric:tabular-nums]">{fmt(line.theoretical_usage)}</td>
                          <td className="pb-3 text-right">
                            <VariancePill
                              variance={line.variance}
                              theoretical={line.theoretical_usage}
                              unit={line.unit}
                            />
                          </td>
                          <td className="pb-3 text-right [font-variant-numeric:tabular-nums]">
                            <span
                              className={
                                (line.variance_pct ?? 0) > 0
                                  ? "text-red"
                                  : (line.variance_pct ?? 0) < 0
                                    ? "text-green"
                                    : "text-muted"
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
                <p className="px-6 pt-2 pb-6 text-xs text-muted">
                  Actual usage = opening + deliveries − waste − ending stock. Variance =
                  actual − theoretical. A positive gap is stock that left without a
                  recorded sale; a negative gap is less used than the recipes expected.
                </p>
              </section>

              <section className="border-t border-line px-6 py-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-serif font-medium text-ink">Shift closes</h3>
                    <p className="mt-0.5 text-xs text-muted">
                      Every saved shift in this period and who prepared it.
                    </p>
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded-full bg-line/50 text-xs text-ink-soft">
                    {report.closings.length}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="text-left border-b border-line">
                        <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider">Date</th>
                        <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider">Shift</th>
                        <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider">Prepared by</th>
                        <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.closings.map((closing) => (
                        <tr key={closing.id} className="border-b border-line/50">
                          <td className="pb-3">{formatDate(closing.date)}</td>
                          <td className="pb-3">{shiftLabel(closing.shift)}</td>
                          <td className="pb-3">
                            {closing.prepared_by ? (
                              <strong className="text-ink">{closing.prepared_by}</strong>
                            ) : (
                              <span className="text-muted">Not recorded</span>
                            )}
                          </td>
                          <td className="pb-3 text-right">
                            {closing.flagged_count > 0 ? (
                              <span className="text-red">{closing.flagged_count} flagged</span>
                            ) : (
                              <span className="text-muted">Balanced</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
                <section className="border-t border-line px-6 py-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-serif font-medium text-ink">Drinks sold</h3>
                      <p className="mt-0.5 text-xs text-muted">
                        POS and manual cups across the period.
                      </p>
                    </div>
                    <span className="inline-block px-2 py-0.5 rounded-full bg-line/50 text-xs text-ink-soft">
                      {fmt(report.total_cups)} cups
                    </span>
                  </div>
                  {report.sales.length === 0 ? (
                    <p className="px-6 pt-2 pb-6 text-xs text-muted">
                      No drinks were recorded in this range.
                    </p>
                  ) : (
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="text-left border-b border-line">
                          <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider">Beverage</th>
                          <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider">Size</th>
                          <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Cups</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.sales.map((sale) => (
                          <tr key={`${sale.product_name}-${sale.size_label}`} className="border-b border-line/50">
                            <td className="pb-3">{sale.product_name}</td>
                            <td className="pb-3">{sale.size_label || "—"}</td>
                            <td className="pb-3 text-right [font-variant-numeric:tabular-nums] font-medium text-ink">{fmt(sale.quantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>

                <section className="border-t border-line px-6 py-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-serif font-medium text-ink">Shift notes</h3>
                      <p className="mt-0.5 text-xs text-muted">
                        What the team recorded at closing.
                      </p>
                    </div>
                    <span className="inline-block px-2 py-0.5 rounded-full bg-line/50 text-xs text-ink-soft">
                      {report.notes.length}
                    </span>
                  </div>
                  {report.notes.length === 0 ? (
                    <p className="px-6 pt-2 pb-6 text-xs text-muted">
                      No notes were left in this range.
                    </p>
                  ) : (
                    <ul className="px-6 pb-6 space-y-2">
                      {report.notes.map((note) => (
                        <li key={`${note.date}-${note.shift}`}>
                          <strong className="text-ink">
                            {formatDate(note.date)} · {shiftLabel(note.shift)}
                          </strong>
                          {note.prepared_by && (
                            <span className="block text-xs text-muted mt-0.5">
                              Prepared by {note.prepared_by}
                            </span>
                          )}
                          <span className="text-sm text-muted">{note.notes}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <footer className="px-6 py-4 border-t border-line text-xs text-muted flex justify-between">
                <span>
                  {report.closing_count} shift close{report.closing_count === 1 ? "" : "s"} ·
                  saved snapshots only
                </span>
                <span className="print:block hidden">Brew Ledger · ending report</span>
              </footer>
            </>
          )}
        </article>
      ) : null}
    </div>
  );
}
