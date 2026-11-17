import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
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
  IconRecipes,
  IconReport,
  IconSettings,
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
    <div className="flex h-screen bg-bg text-ink" data-currency={currency}>
      <aside className="w-64 bg-surface border-r border-line flex flex-col">
        <div className="p-5 brand">
          <span className="brand-mark">
            <IconCoffee size={21} />
          </span>
          <span className="brand-text block ml-2">
            <strong className="text-lg font-serif text-ink">Brew Ledger</strong>
            <small className="text-muted">Inventory variance</small>
          </span>
        </div>

        <nav className="flex-1 px-3 py-2 nav" aria-label="Main">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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

      <main className="flex-1 overflow-y-auto bg-bg">
        {dbError ? (
          <div className="p-6 bg-red-soft border border-red rounded-lg">
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
      </main>
      <BackToTop />
    </div>
  );
}
