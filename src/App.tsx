import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Recipes from "./pages/Recipes";
import Library from "./pages/Library";
import Inventory from "./pages/Inventory";
import History from "./pages/History";
import Report from "./pages/Report";
import BackToTop from "./components/BackToTop";
import {
  IconCoffee,
  IconDashboard,
  IconHistory,
  IconInventory,
  IconLibrary,
  IconRecipes,
  IconReport,
} from "./components/Icons";

const links = [
  { to: "/", label: "Overview", icon: IconDashboard, end: true },
  { to: "/recipes", label: "Recipes", icon: IconRecipes },
  { to: "/library", label: "Costing library", icon: IconLibrary },
  { to: "/inventory", label: "Daily count", icon: IconInventory },
  { to: "/report", label: "Ending report", icon: IconReport },
  { to: "/history", label: "History", icon: IconHistory },
];

export default function App() {
  return (
    <div className="app-shell">
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
          Stored locally in SQLite
        </div>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/library" element={<Library />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/report" element={<Report />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<History />} />
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
      </main>
      <BackToTop />
    </div>
  );
}
