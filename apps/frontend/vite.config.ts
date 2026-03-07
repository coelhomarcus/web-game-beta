import { defineConfig } from "vite";

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 4000, // kB — silences the warning for large Three.js bundles
  },
});
