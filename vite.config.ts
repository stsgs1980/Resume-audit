import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: ".",
  build: {
    outDir: "dist/ui",
    emptyOutDir: true,
  },
  server: {
    port: 4174,
    strictPort: true,
  },
});
