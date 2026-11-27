import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// The app is served by the Worker (same origin as /api), so base is "/".
// In local dev, /api is proxied to `wrangler dev` on port 8787.
export default defineConfig({
  plugins: [preact()],
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
