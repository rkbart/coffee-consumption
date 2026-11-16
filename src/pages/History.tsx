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

      {error && <div className="banner banner-error">{error}</div>}

      {closings.length === 0 ? (
        <div className="empty-state">
          <h2>No closings saved yet</h2>
          <p>Finish a daily count and save it to start building the ledger.</p>
          <Link className="btn btn-primary" to="/inventory">
            Go to the count sheet
          </Link>
        </div>
      ) : (
        <div className="history-layout">
          <aside className="card history-list">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search date or note…"
              label="Search closing history"
            />
            <div className="history-list-head">
              <p className="mini-label">{query ? "Matching closings" : "All closings"}</p>
              <span className="count-chip">{filteredClosings.length}</span>
            </div>
            {filteredClosings.length === 0 && (
              <p className="muted small history-no-match">
                No closings match this search.
              </p>
            )}
            <ul>
              {pagedClosings.map((closing) => (
                <li key={closing.id}>
                  <Link
                    to={`/history/${closing.id}`}
                    className={`history-item${closing.id === selectedId ? " active" : ""}`}
                  >
                    <span>
                      <strong>{formatDate(closing.date)}</strong>
                      <small>
                        {shiftShort(closing.shift)}
                        {closing.prepared_by ? ` · ${closing.prepared_by}` : ""} ·{" "}
                        {closing.ingredient_count} ingredients
                      </small>
                    </span>
                    {closing.flagged_count > 0 ? (
                      <span className="flag-badge">{closing.flagged_count}</span>
                    ) : (
                      <span className="check-badge">✓</span>
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

          <section className="stack">
            {!detail || loadingDetail ? (
              <div className="card skeleton-card" />
            ) : (
              <>
                <div className="card">
                  <div className="history-detail-head">
                    <div>
                      <p className="eyebrow">Reconciliation</p>
                      <h2>{formatDate(detail.date, "long")}</h2>
                      <div className="history-meta">
                        <span className={`shift-badge ${detail.shift}`}>
                          {shiftLabel(detail.shift)}
                        </span>
                        <span>
                          Prepared by <strong>{detail.prepared_by || "not recorded"}</strong>
                        </span>
                      </div>
                    </div>
                    <div className="history-detail-actions">
                      {flagged > 0 ? (
                        <span className="pill pill-over">
                          <span className="pill-dot" /> {flagged} flagged
                        </span>
                      ) : (
                        <span className="pill pill-on-target">
                          <span className="pill-dot" /> Balanced
                        </span>
                      )}
                      <button
                        className="icon-btn danger"
                        aria-label="Delete closing"
                        onClick={() => setConfirmDelete(true)}
                      >
                        <IconTrash size={17} />
                      </button>
                    </div>
                  </div>

                  {detail.notes && <p className="hero-note"><span>Shift note</span> {detail.notes}</p>}

                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Ingredient</th>
                          <th className="right">Opening</th>
                          <th className="right">Deliv.</th>
                          <th className="right">Waste</th>
                          <th className="right">Closing</th>
                          <th className="right">Actual</th>
                          <th className="right">Theory</th>
                          <th className="right">Variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.lines.map((line) => (
                          <tr key={line.id}>
                            <td>
                              <strong>{line.ingredient_name}</strong>
                              <small className="unit-inline"> {unitLabel(line.unit)}</small>
                            </td>
                            <td className="right numeric">{fmt(line.opening)}</td>
                            <td className="right numeric">{fmt(line.deliveries)}</td>
                            <td className="right numeric">{fmt(line.waste)}</td>
                            <td className="right numeric">{fmt(line.closing)}</td>
                            <td className="right numeric strong">{fmt(line.actual_usage)}</td>
                            <td className="right numeric">{fmt(line.theoretical_usage)}</td>
                            <td className="right">
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

                <div className="card">
                  <div className="panel-head">
                    <div>
                      <p className="eyebrow">POS record</p>
                      <h2>Drinks sold</h2>
                    </div>
                    <span className="count-chip">
                      {detail.sales.reduce((sum, sale) => sum + sale.quantity, 0)} cups
                    </span>
                  </div>
                  <div className="sold-chips">
                    {detail.sales.map((sale) => (
                      <span className="sold-chip" key={sale.id}>
                        <strong>{sale.quantity}×</strong> {sale.product_name}
                        {sale.size_label && <small>{sale.size_label}</small>}
                      </span>
                    ))}
                  </div>
                </div>

                <Link
                  to={`/inventory?date=${detail.date}&shift=${detail.shift}`}
                  className="text-link back-link"
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
        <p className="confirm-copy">
          {detail
            ? `${formatDate(detail.date, "long")} · ${shiftLabel(detail.shift)}`
            : ""}{" "}
          will no longer appear in your history.
        </p>
        <div className="form-actions">
          <button className="btn btn-quiet" onClick={() => setConfirmDelete(false)}>
            Keep it
          </button>
          <button className="btn btn-danger" onClick={remove}>
            Delete closing
          </button>
        </div>
      </Modal>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
