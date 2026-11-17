import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import { api } from "../api";
import type { Overview } from "../types";
import { getCurrencySymbol, setCurrencySymbol } from "../lib";
import {
  IconDatabase,
  IconDownload,
  IconSettings,
  IconUpload,
} from "../components/Icons";

type ConfirmAction = "import" | "demo" | "reset";

const currencyExample = (currency: string) => {
  const symbol = currency.trim() || "—";
  return `${symbol}${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(1250)}`;
};

export default function Settings() {
  const [currency, setCurrency] = useState(getCurrencySymbol());
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [pendingImport, setPendingImport] = useState<{ name: string; csv: string } | null>(
    null,
  );
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [resetPhrase, setResetPhrase] = useState("");
  const [busyAction, setBusyAction] = useState<ConfirmAction | null>(null);

  useEffect(() => {
    Promise.all([api.settings(), api.overview()])
      .then(([settings, nextOverview]) => {
        setCurrency(settings.currency);
        setCurrencySymbol(settings.currency);
        setOverview(nextOverview);
        setError("");
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load settings"),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const saveCurrency = async (event: FormEvent) => {
    event.preventDefault();
    const next = currency.trim();
    if (!next) {
      setError("Enter a currency symbol.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const settings = await api.updateSettings({ currency: next });
      setCurrency(settings.currency);
      setCurrencySymbol(settings.currency);
      setToast("Currency updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the currency");
    } finally {
      setSaving(false);
    }
  };

  const exportBackup = async () => {
    setError("");
    try {
      const csv = await api.exportBackup();
      const blob = new Blob([csv], { type: "text/csv; charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `brew-ledger-backup-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToast("Backup exported");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export backup");
    }
  };

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setError("That backup is larger than 20 MB.");
      return;
    }
    try {
      const csv = await file.text();
      setError("");
      setPendingImport({ name: file.name, csv });
      setConfirmAction("import");
    } catch {
      setError("Could not read that file.");
    }
  };

  const closeConfirm = () => {
    if (busyAction) return;
    setConfirmAction(null);
    setPendingImport(null);
    setResetPhrase("");
  };

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    setBusyAction(confirmAction);
    setError("");
    try {
      if (confirmAction === "import") {
        if (!pendingImport) throw new Error("Choose a backup file first.");
        await api.importBackup(pendingImport.csv);
      } else if (confirmAction === "demo") {
        await api.loadDemo();
      } else {
        await api.resetDatabase();
      }
      const settings = await api.settings();
      setCurrencySymbol(settings.currency);
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the database");
      setConfirmAction(null);
      setPendingImport(null);
      setResetPhrase("");
      setBusyAction(null);
    }
  };

  const counts = overview?.counts;
  const hasData = Boolean(
    counts && (counts.ingredients || counts.beverages || counts.closings),
  );

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Shop settings"
        description="Set how prices are displayed, move your ledger between machines, load a sample, or start over with a clean database."
      />

      {error && <div className="banner banner-error">{error}</div>}

      {loading ? (
        <div className="card skeleton-card" />
      ) : (
        <div className="settings-grid">
          <section className="card settings-card">
            <div className="settings-icon">
              <IconSettings size={19} />
            </div>
            <p className="eyebrow">Appearance</p>
            <h2>Currency</h2>
            <p className="muted small settings-copy">
              Used for pack prices, food cost, selling price and margins across the
              library and recipes.
            </p>
            <form className="settings-form" onSubmit={saveCurrency}>
              <label className="field">
                <span>Currency symbol</span>
                <input
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  placeholder="₱"
                  maxLength={8}
                  list="currency-symbols"
                  autoComplete="off"
                />
                <datalist id="currency-symbols">
                  <option value="₱">Philippine peso</option>
                  <option value="$">US dollar</option>
                  <option value="€">Euro</option>
                  <option value="£">British pound</option>
                  <option value="¥">Yen / yuan</option>
                  <option value="₹">Indian rupee</option>
                  <option value="Rp">Indonesian rupiah</option>
                  <option value="RM">Malaysian ringgit</option>
                  <option value="฿">Thai baht</option>
                  <option value="₫">Vietnamese dong</option>
                  <option value="AED">UAE dirham</option>
                </datalist>
                <small className="field-hint">
                  Examples: ₱, $, €, RM or “AED”. Up to 8 characters.
                </small>
              </label>
              <div className="currency-preview">
                <span className="mini-label">Price preview</span>
                <strong className="numeric">{currencyExample(currency)}</strong>
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save currency"}
              </button>
            </form>
          </section>

          <section className="card settings-card">
            <div className="settings-icon">
              <IconDatabase size={19} />
            </div>
            <p className="eyebrow">Backup</p>
            <h2>Import &amp; export</h2>
            <p className="muted small settings-copy">
              One CSV contains the costing library, menu recipes, closings, shift sales
              and your settings. Importing replaces everything currently in this
              database.
            </p>
            <div className="settings-actions">
              <button className="btn btn-primary" onClick={exportBackup}>
                <IconDownload size={16} /> Export backup
              </button>
              <label className="btn btn-quiet file-picker">
                <IconUpload size={16} /> Import backup
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={chooseFile}
                  hidden
                />
              </label>
            </div>
            <p className="settings-note">
              Keep a backup before changing machines or redeploying to a host with a
              temporary filesystem.
            </p>
          </section>

          <section className="card settings-card">
            <div className="settings-icon">
              <IconDatabase size={19} />
            </div>
            <p className="eyebrow">Sample</p>
            <h2>Try the demo ledger</h2>
            <p className="muted small settings-copy">
              New databases start empty. Load the sample café if you want to explore
              the app first: four ingredients, eight drinks and three shift closings.
            </p>
            <div className="settings-actions">
              <button
                className="btn btn-quiet"
                onClick={() => setConfirmAction("demo")}
                disabled={Boolean(busyAction)}
              >
                Load demo data
              </button>
            </div>
            <p className="settings-note">
              This replaces the current business data. Export a backup first if you
              need to keep it.
            </p>
          </section>

          <section className="card settings-card danger-zone">
            <div className="settings-icon danger">
              <IconDatabase size={19} />
            </div>
            <p className="eyebrow">Danger zone</p>
            <h2>Reset database</h2>
            <p className="muted small settings-copy">
              Permanently deletes every ingredient, menu item, recipe, closing and
              sale. Your currency setting is kept. This cannot be undone.
            </p>
            {hasData && counts && (
              <p className="settings-counts">
                Currently {counts.ingredients} ingredients · {counts.beverages} beverages
                · {counts.closings} closings
              </p>
            )}
            <div className="settings-actions">
              <button
                className="btn btn-danger"
                onClick={() => setConfirmAction("reset")}
                disabled={Boolean(busyAction)}
              >
                Reset all data
              </button>
            </div>
          </section>
        </div>
      )}

      <Modal
        open={confirmAction !== null}
        title={
          confirmAction === "import"
            ? "Replace this database?"
            : confirmAction === "demo"
              ? "Load the demo ledger?"
              : "Delete all business data?"
        }
        subtitle={
          confirmAction === "import"
            ? "The CSV is validated before anything is changed."
            : confirmAction === "demo"
              ? "The current catalogue and closing history will be replaced."
              : "This removes the catalogue and closing history permanently."
        }
        onClose={closeConfirm}
      >
        {confirmAction === "import" && pendingImport && (
          <p className="confirm-copy">
            Import <strong>{pendingImport.name}</strong>? Every existing ingredient,
            beverage, closing and sale will be replaced by the backup.
          </p>
        )}
        {confirmAction === "demo" && (
          <p className="confirm-copy">
            This clears the current business data and loads the sample ingredients,
            drinks and closings. Your currency setting is kept.
          </p>
        )}
        {confirmAction === "reset" && (
          <>
            <p className="confirm-copy">
              This cannot be undone. Type <strong>RESET</strong> to confirm.
            </p>
            <label className="field">
              <span>Confirmation</span>
              <input
                value={resetPhrase}
                onChange={(event) => setResetPhrase(event.target.value)}
                placeholder="RESET"
                autoFocus
              />
            </label>
          </>
        )}

        <div className="form-actions">
          <button className="btn btn-quiet" onClick={closeConfirm} disabled={Boolean(busyAction)}>
            Cancel
          </button>
          <button
            className={confirmAction === "reset" ? "btn btn-danger" : "btn btn-primary"}
            onClick={runConfirmedAction}
            disabled={
              Boolean(busyAction) ||
              (confirmAction === "reset" && resetPhrase.trim().toUpperCase() !== "RESET")
            }
          >
            {busyAction
              ? "Working…"
              : confirmAction === "import"
                ? "Replace with backup"
                : confirmAction === "demo"
                  ? "Replace with demo"
                  : "Delete all data"}
          </button>
        </div>
      </Modal>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
