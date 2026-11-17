import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import { migrationsReady } from "./db/client";
import { seed } from "./db/seed";

const BOOT_TIMEOUT_MS = 30_000;

const boot = () => migrationsReady.then(() => seed());
const timeout = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error("Database initialization timed out")), BOOT_TIMEOUT_MS),
);

const isolated = typeof crossOriginIsolated !== "undefined" ? crossOriginIsolated : "unknown";

function showError(msg: string) {
  console.error("Failed to initialize database:", msg);
  document.getElementById("root")!.innerHTML = `
    <p style="color:red; padding:1rem; font-family: system-ui, sans-serif;">
      Something went wrong setting up the app: ${msg}<br/>
      <small>Cross-origin isolated: ${isolated}</small>
    </p>
  `;
}

Promise.race([boot(), timeout])
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
    showError((err as Error).message);
  });
