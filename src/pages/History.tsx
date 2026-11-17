import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import SearchField from "../components/SearchField";
import VariancePill from "../components/VariancePill";
import { useDebouncedValue } from "../hooks";
import { api } from "../api";
import type { ClosingDetail, ClosingSummary } from "../types";
import { fmt, formatDate, isFlagged, shiftLabel, shiftShort, unitLabel } from "../lib";
import { IconArrowLeft, IconTrash } from "../components/Icons";

export default function History() {
  const { id } = useParams();
  const navigate = useNavigate();
  const selectedId = id ? Number(id) : null;

  const [closings, setClosings] = useState<ClosingSummary[]>([]);
  const [detail, setDetail] = useState<ClosingDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [page, setPage] = useState(1);

  const query = debouncedSearch.trim().toLowerCase();
  const perPage = 8;
  const filteredClosings = useMemo(
    () =>
      closings.filter((closing) => {
        if (!query) return true;
        return `${closing.date} ${formatDate(closing.date)} ${formatDate(closing.date, "long")} ${shiftLabel(closing.shift)} ${closing.prepared_by} ${closing.notes}`
          .toLowerCase()
          .includes(query);
      }),
    [closings, query],
  );
  const pageCount = Math.max(1, Math.ceil(filteredClosings.length / perPage));
  const safePage = Math.min(page, pageCount);
  const pagedClosings = filteredClosings.slice((safePage - 1) * perPage, safePage * perPage);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    if (!selectedId) return;
    const index = filteredClosings.findIndex((row) => row.id === selectedId);
    if (index >= 0) setPage(Math.floor(index / perPage) + 1);
  }, [selectedId, filteredClosings, perPage]);

  useEffect(() => {
    api
      .closings()
      .then((rows) => {
        setClosings(rows);
        if (!selectedId && rows.length > 0) {
          navigate(`/history/${rows[0].id}`, { replace: true });
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load history"));
  }, [navigate, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let ignore = false;
    setLoadingDetail(true);
    api
      .closing(selectedId)
      .then((row) => {
        if (!ignore) {
          setDetail(row);
          setError("");
        }
      })
      .catch((err) => {
        if (!ignore) setError(err instanceof Error ? err.message : "Could not load closing");
      })
      .finally(() => {
        if (!ignore) setLoadingDetail(false);
      });
    return () => {
      ignore = true;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const remove = async () => {
    if (!detail) return;
    try {
      await api.deleteClosing(detail.id);
      const rows = await api.closings();
      setClosings(rows);
      setDetail(null);
      setConfirmDelete(false);
      setToast("Closing removed");
      navigate(rows.length ? `/history/${rows[0].id}` : "/history", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove closing");
      setConfirmDelete(false);
    }
  };

  const flagged = detail?.lines.filter(isFlagged).length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="The record"
        title="Closing history"
        description="Every saved close is a snapshot. Recipes can change tomorrow; these numbers stay as they were counted."
      />

      {error && (
        <div className="bg-red-soft border border-red rounded-lg p-3 flex items-center gap-2">
          {error}
        </div>
      )}

      {closings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <h2 className="text-lg font-serif font-medium text-ink">No closings saved yet</h2>
          <p className="mt-1 text-muted text-sm max-w-xs mx-auto">
            Finish a daily count and save it to start building the ledger.
          </p>
          <Link className="mt-4 bg-ink text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors" to="/inventory">
            Go to the count sheet
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="bg-surface border border-line rounded-lg lg:col-span-4">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search date or note…"
              label="Search closing history"
            />
            <div className="flex items-center justify-between mb-3 px-4 pt-4">
              <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider">
                {query ? "Matching closings" : "All closings"}
              </p>
              <span className="inline-block px-2 py-0.5 rounded-full bg-line/50 text-xs text-ink-soft">
                {filteredClosings.length}
              </span>
            </div>
            {filteredClosings.length === 0 && (
              <p className="px-4 text-xs text-muted">No closings match this search.</p>
            )}
            <ul className="px-4 pb-4 space-y-1">
              {pagedClosings.map((closing) => (
                <li key={closing.id}>
                  <Link
                    to={`/history/${closing.id}`}
                    className={`flex items-center justify-between p-2 rounded-lg transition-colors no-underline ${
                      closing.id === selectedId
                        ? "bg-accent-soft text-accent-dark"
                        : "text-accent hover:bg-surface-2"
                    }`}
                  >
                    <span className="flex flex-col gap-0.5">
                      <strong className="text-ink">{formatDate(closing.date)}</strong>
                      <span className="text-xs text-muted">
                        {shiftShort(closing.shift)}
                        {closing.prepared_by ? ` · ${closing.prepared_by}` : ""} ·{" "}
                        {closing.ingredient_count} ingredients
                      </span>
                    </span>
                    {closing.flagged_count > 0 ? (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-red-soft text-red text-[10px] font-medium">
                        {closing.flagged_count}
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-green-soft text-green text-[10px] font-medium">
                        ✓
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination
              page={safePage}
              pageCount={pageCount}
              total={filteredClosings.length}
              pageSize={perPage}
              onPageChange={setPage}
              label="closings"
            />
          </aside>

          <section className="flex flex-col gap-4 lg:col-span-8">
            {!detail || loadingDetail ? (
              <div className="bg-surface border border-line rounded-lg h-64 flex items-center justify-center" />
            ) : (
              <>
                <div className="bg-surface border border-line rounded-lg overflow-hidden">
                  <div className="flex flex-col gap-3 border-b border-line px-4 pb-3 pt-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Reconciliation</p>
                      <h2 className="text-lg font-serif font-medium text-ink">
                        {formatDate(detail.date, "long")}
                      </h2>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                        <span className={`inline-block px-2 py-0.5 rounded-full bg-surface-2 text-xs text-ink`}>
                          {shiftLabel(detail.shift)}
                        </span>
                        <span>
                          Prepared by <strong className="text-ink">{detail.prepared_by || "not recorded"}</strong>
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {flagged > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-soft text-red text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {flagged} flagged
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-soft text-green text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          Balanced
                        </span>
                      )}
                      <button
                        type="button"
                        className="p-1.5 hover:bg-red-soft rounded-lg text-muted hover:text-red transition-colors"
                        aria-label="Delete closing"
                        onClick={() => setConfirmDelete(true)}
                      >
                        <IconTrash size={17} />
                      </button>
                    </div>
                  </div>

                  {detail.notes && (
                    <p className="px-4 pt-3 pb-2 text-sm text-muted flex items-center gap-2">
                      <span className="font-medium text-ink">Shift note</span> {detail.notes}
                    </p>
                  )}

                  <div className="overflow-x-auto px-3 pb-4 sm:px-4">
                    <table className="w-full min-w-[650px] border-collapse text-sm">
                      <thead>
                        <tr className="text-left border-b border-line">
                          <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider">Ingredient</th>
                          <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Opening</th>
                          <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Deliv.</th>
                          <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Waste</th>
                          <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Closing</th>
                          <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Actual</th>
                          <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Theory</th>
                          <th className="pb-2 font-medium text-ink-soft text-xs uppercase tracking-wider text-right">Variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.lines.map((line) => (
                          <tr key={line.id} className="border-b border-line/50">
                            <td className="pb-3">
                              <strong className="text-ink">{line.ingredient_name}</strong>
                              <span className="ml-0.5 text-xs text-muted">{unitLabel(line.unit)}</span>
                            </td>
                            <td className="pb-3 text-right [font-variant-numeric:tabular-nums]">{fmt(line.opening)}</td>
                            <td className="pb-3 text-right [font-variant-numeric:tabular-nums]">{fmt(line.deliveries)}</td>
                            <td className="pb-3 text-right [font-variant-numeric:tabular-nums]">{fmt(line.waste)}</td>
                            <td className="pb-3 text-right [font-variant-numeric:tabular-nums]">{fmt(line.closing)}</td>
                            <td className="pb-3 text-right [font-variant-numeric:tabular-nums] font-medium text-ink">{fmt(line.actual_usage)}</td>
                            <td className="pb-3 text-right [font-variant-numeric:tabular-nums]">{fmt(line.theoretical_usage)}</td>
                            <td className="pb-3 text-right">
                              <VariancePill
                                variance={line.variance}
                                theoretical={line.theoretical_usage}
                                unit={line.unit}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-surface border border-line rounded-lg overflow-hidden">
                  <div className="flex items-start justify-between mb-3 px-4 pt-4 pb-2 border-b border-line">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">POS record</p>
                      <h2 className="text-lg font-serif font-medium text-ink">Drinks sold</h2>
                    </div>
                    <span className="inline-block px-2 py-0.5 rounded-full bg-line/50 text-xs text-ink-soft">
                      {detail.sales.reduce((sum, sale) => sum + sale.quantity, 0)} cups
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 px-4 pb-4">
                    {detail.sales.map((sale) => (
                      <span
                        key={sale.id}
                        className="px-2 py-0.5 rounded bg-surface-2 text-xs text-ink-soft"
                      >
                        <strong className="text-ink">{sale.quantity}×</strong> {sale.product_name}
                        {sale.size_label && <span className="ml-0.5 text-xs text-muted">{sale.size_label}</span>}
                      </span>
                    ))}
                  </div>
                </div>

                <Link
                  to={`/inventory?date=${detail.date}&shift=${detail.shift}`}
                  className="text-accent hover:underline text-sm font-medium inline-flex items-center gap-1 px-4 pt-3 pb-6"
                >
                  <IconArrowLeft size={15} /> Need to correct this? Reopen the count sheet
                </Link>
              </>
            )}
          </section>
        </div>
      )}

      <Modal
        open={confirmDelete}
        title="Delete this closing?"
        subtitle="This removes the snapshot permanently. The count sheet is not affected."
        onClose={() => setConfirmDelete(false)}
      >
        <p className="text-sm text-ink mb-4">
          {detail
            ? `${formatDate(detail.date, "long")} · ${shiftLabel(detail.shift)}`
            : ""}{" "}
          will no longer appear in your history.
        </p>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-3">
          <button
            type="button"
            className="bg-surface border border-line rounded-lg px-4 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2 hover:text-ink transition-colors"
            onClick={() => setConfirmDelete(false)}
          >
            Keep it
          </button>
          <button
            type="button"
            className="bg-red text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-dark transition-colors"
            onClick={remove}
          >
            Delete closing
          </button>
        </div>
      </Modal>

      {toast && <div className="fixed bottom-4 right-4 z-50 bg-ink text-white px-4 py-2 rounded-lg shadow-lg">{toast}</div>}
    </>
  );
}
