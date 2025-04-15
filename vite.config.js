import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Custom port for dev if needed:
    port: 5173,
  },
  // 👇 This is what ensures fallback routing in production
  build: {
    outDir: "dist",
  },
});
