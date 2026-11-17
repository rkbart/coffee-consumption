import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import { migrationsReady } from "./db/client";
import { seed } from "./db/seed";

// Boot: wait for the OPFS database schema to exist, ensure the default shop
// settings (currency), then render. One browser, one profile — no users, no
// auth, no server round-trip.
migrationsReady
  .then(() => seed())
  .then(() => {
    sessionStorage.removeItem("route-error:auto-reloaded");
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>,
    );
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    document.getElementById("root")!.innerHTML =
      '<p>Something went wrong setting up the app. Check the console.</p>';
  });
