// Allows Vite to handle React features via the @vitejs/plugin-react plugin.

// port: Sets a dev server port for local testing.

// build.outDir: is where vite dumps the production files — vercel uses the dist folder.



import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Custom port for dev if needed:
    port: 5173,
  },
  // This is what ensures fallback routing in production
  build: {
    outDir: "dist",
  },
});
