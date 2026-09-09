import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// This config lives at src/frontend/vite.config.ts so its __dirname IS the
// frontend root (where index.html and public/ live). The production build is
// emitted to dist/frontend/build, exactly the directory the backend serves via
// express.static(path.join(__dirname, "../frontend/build")) and the SPA
// fallback expects (see src/backend/app.ts).
const frontendRoot = __dirname;
const buildOutDir = path.resolve(__dirname, "../../dist/frontend/build");

export default defineConfig({
  root: frontendRoot,
  plugins: [react()],
  base: "/",
  build: {
    outDir: buildOutDir,
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:5000",
      "/uploads": "http://localhost:5000",
      "/meta": "http://localhost:5000",
    },
  },
});