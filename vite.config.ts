import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import sqlocal from "sqlocal/vite";

export default defineConfig({
  plugins: [react(), sqlocal()],
  server: {
    port: 5173,
  },
});
