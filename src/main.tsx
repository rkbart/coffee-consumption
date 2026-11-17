import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import { migrationsReady } from "./db/client";
import { seed } from "./db/seed";

const BOOT_TIMEOUT_MS = 10_000;

const boot = () => migrationsReady.then(() => seed());
const timeout = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error("Database initialization timed out")), BOOT_TIMEOUT_MS),
);

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
    console.error("Failed to initialize database:", err);
    document.getElementById("root")!.innerHTML = `<p style="color:red">Something went wrong setting up the app: ${(err as Error).message}</p>`;
  });
