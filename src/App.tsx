import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Skeleton } from "boneyard-js/react";
import { settingsRepository } from "./repositories/settings-repository";
import { getCurrencySymbol, setCurrencySymbol } from "./lib";
import Dashboard from "./pages/Dashboard";
import Recipes from "./pages/Recipes";
import Library from "./pages/Library";
import Inventory from "./pages/Inventory";
import History from "./pages/History";
import Report from "./pages/Report";
import Settings from "./pages/Settings";
import BackToTop from "./components/BackToTop";
import {
  IconCoffee,
  IconDashboard,
  IconHistory,
  IconInventory,
  IconLibrary,
  IconMenu,
  IconRecipes,
  IconReport,
  IconSettings,
  IconClose,
} from "./components/Icons";

const links = [
  { to: "/", label: "Overview", icon: IconDashboard, end: true },
  { to: "/recipes", label: "Recipes", icon: IconRecipes },
  { to: "/library", label: "Costing library", icon: IconLibrary },
  { to: "/inventory", label: "Daily count", icon: IconInventory },
  { to: "/report", label: "Ending report", icon: IconReport },
  { to: "/history", label: "History", icon: IconHistory },
  { to: "/settings", label: "Settings", icon: IconSettings },
];

export default function App({ dbReady }: { dbReady: Promise<void> }) {
  const [currency, setCurrency] = useState(getCurrencySymbol());
  const [dbLoaded, setDbLoaded] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!mobileNavOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };
    document.body.classList.add("mobile-nav-open");
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("mobile-nav-open");
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileNavOpen]);

  useEffect(() => setMobileNavOpen(false), [location.pathname]);

  useEffect(() => {
    const syncCurrency = (event: Event) => {
      setCurrency((event as CustomEvent<string>).detail);
    };
    window.addEventListener("brew-currency", syncCurrency);
    settingsRepository
      .getCurrency()
      .then((currencyValue) => {
        setCurrencySymbol(currencyValue);
        setCurrency(currencyValue);
      })
      .catch(() => {
        /* the cached currency still lets the rest of the app render */
      });
    return () => window.removeEventListener("brew-currency", syncCurrency);
  }, []);

  useEffect(() => {
    dbReady
      .then(() => {
        setDbLoaded(true);
      })
      .catch((err) => {
        setDbError((err as Error).message);
        setDbLoaded(true);
      });
  }, [dbReady]);

  return (
    <div className="app-shell flex h-screen h-[100dvh] overflow-hidden bg-bg text-ink" data-currency={currency}>
      <aside
        id="mobile-navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[calc(100vw-3rem)] flex-col overflow-y-auto border-r border-line bg-surface transition-transform duration-200 md:visible md:static md:z-auto md:w-64 md:max-w-none md:translate-x-0 md:shadow-none print:hidden ${
          mobileNavOpen ? "visible translate-x-0 shadow-xl" : "invisible -translate-x-full"
        }`}
        aria-label="Main navigation"
      >
        <div className="flex items-center gap-2 p-4 sm:p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-dark">
            <IconCoffee size={21} />
          </span>
          <span className="block min-w-0">
            <strong className="block text-lg font-serif leading-tight text-ink">Brew Ledger</strong>
            <small className="block text-muted">Inventory variance</small>
          </span>
          <button
            type="button"
            className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink md:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          >
            <IconClose size={19} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-2 nav" aria-label="Main">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-accent-soft text-accent-dark"
                    : "text-ink-soft hover:bg-surface-2 hover:text-ink"
                }`
              }
            >
              <Icon size={18} className="shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-5 sidebar-card">
          <p className="font-serif font-medium text-ink mb-1">The daily habit</p>
          <p className="text-sm text-muted leading-relaxed">
            Count what is left, log what you sold, and let the recipes tell you what
            should have been used.
          </p>
        </div>

        <div className="p-4 sidebar-foot border-t border-line flex items-center gap-2 text-xs text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span>SQLite · {currency}</span>
        </div>
      </aside>

      <button
        type="button"
        className={`fixed inset-0 z-30 bg-ink/40 transition-opacity md:hidden print:hidden ${
          mobileNavOpen ? "visible opacity-100" : "invisible opacity-0"
        }`}
        onClick={() => setMobileNavOpen(false)}
        aria-label="Close navigation menu"
        tabIndex={mobileNavOpen ? 0 : -1}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2.5 md:hidden print:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-dark">
              <IconCoffee size={20} />
            </span>
            <span className="block min-w-0">
              <strong className="block text-lg font-serif leading-tight text-ink">Brew Ledger</strong>
              <small className="block text-muted">Inventory variance</small>
            </span>
          </div>
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-navigation"
          >
            <IconMenu size={21} />
          </button>
        </header>

        <main id="app-main" className="app-main min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-bg">
          <div className="min-h-full p-4 sm:p-6 lg:p-8 print:p-0">
            {dbError ? (
              <div className="rounded-lg border border-red bg-red-soft p-4 sm:p-6">
                <p className="text-red">Something went wrong setting up the app: {dbError}</p>
              </div>
            ) : (
              <Routes>
            <Route
              path="/"
              element={
                <Skeleton name="dashboard" loading={!dbLoaded}>
                  <Dashboard />
                </Skeleton>
              }
            />
            <Route
              path="/recipes"
              element={
                <Skeleton name="recipes" loading={!dbLoaded}>
                  <Recipes />
                </Skeleton>
              }
            />
            <Route
              path="/library"
              element={
                <Skeleton name="library" loading={!dbLoaded}>
                  <Library />
                </Skeleton>
              }
            />
            <Route
              path="/inventory"
              element={
                <Skeleton name="inventory" loading={!dbLoaded}>
                  <Inventory />
                </Skeleton>
              }
            />
            <Route
              path="/report"
              element={
                <Skeleton name="report" loading={!dbLoaded}>
                  <Report />
                </Skeleton>
              }
            />
            <Route
              path="/history"
              element={
                <Skeleton name="history" loading={!dbLoaded}>
                  <History />
                </Skeleton>
              }
            />
            <Route
              path="/history/:id"
              element={
                <Skeleton name="history-detail" loading={!dbLoaded}>
                  <History />
                </Skeleton>
              }
            />
            <Route
              path="/settings"
              element={
                <Skeleton name="settings" loading={!dbLoaded}>
                  <Settings />
                </Skeleton>
              }
            />
            <Route
              path="*"
              element={
                <div className="p-12 text-center">
                  <h2 className="text-2xl font-serif font-medium text-ink">Page not found</h2>
                  <p className="mt-1 text-muted">The page you were looking for is not on the menu.</p>
                </div>
              }
            />
              </Routes>
            )}
          </div>
        </main>
      </div>
      <BackToTop />
    </div>
  );
}
