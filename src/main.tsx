import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles.css";
import "./bones/registry";
import { migrationsReady } from "./db/client";
import { seed } from "./db/seed";

// Start DB initialization in the background immediately — do not block first paint.
const dbReady = (async () => {
  await migrationsReady;
  await seed();
})();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App dbReady={dbReady} />
    </BrowserRouter>
  </StrictMode>,
);

dbReady.catch((err) => {
  console.error("Failed to initialize database:", err);
});
