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
    <div className="app-shell" data-currency={currency}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <IconCoffee size={21} />
          </span>
          <span className="brand-text">
            <strong>Brew Ledger</strong>
            <small>Inventory variance</small>
          </span>
        </div>

        <nav className="nav" aria-label="Main">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-card">
          <p className="sidebar-card-title">The daily habit</p>
          <p>
            Count what is left, log what you sold, and let the recipes tell you what
            should have been used.
          </p>
        </div>

        <div className="sidebar-foot">
          <span className="dot" />
          SQLite · {currency}
        </div>
      </aside>

      <main className="main">
        {dbError ? (
          <div style={{ padding: "1rem", color: "red", fontFamily: "system-ui, sans-serif" }}>
            <p>Something went wrong setting up the app: {dbError}</p>
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
                <div className="empty-state page-enter">
                  <h2>Page not found</h2>
                  <p>The page you were looking for is not on the menu.</p>
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
