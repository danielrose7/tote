import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import path from "path";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [crx({ manifest })],
  resolve: {
    alias: {
      "@tote/schema": path.resolve(__dirname, "../src/schema.ts"),
      "@tote/apiKey": path.resolve(__dirname, "../src/apiKey.ts"),
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: "src/popup/popup.html",
      },
    },
  },
});
