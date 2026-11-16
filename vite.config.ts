import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  root: ".",
  base: "./",
  publicDir: "src/renderer/public",
  server: { watch: { ignored: ["**/android/**", "**/artifacts/**", "**/dist/**", "**/logs/**"] } },
  build: {
    outDir: "dist/renderer",
    emptyOutDir: false
  },
  resolve: {
    alias: {
      "@renderer": path.resolve(__dirname, "src/renderer")
    }
  }
});
