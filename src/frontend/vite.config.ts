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

export default defineConfig(({ command }) => ({
  root: frontendRoot,
  plugins: [react()],
  base: "/",
  // Inject social-profile URLs as build-time literals so the Footer can
  // conditionally render social buttons. Undefined / empty → button hidden;
  // real URL → button rendered with target=_blank + noopener+noreferrer.
  define: {
    __VITE_FACEBOOK_URL__: JSON.stringify(process.env.VITE_FACEBOOK_URL ?? ""),
    __VITE_INSTAGRAM_URL__: JSON.stringify(process.env.VITE_INSTAGRAM_URL ?? ""),
  },
  build: {
    outDir: buildOutDir,
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: command === "build" ? {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('bootstrap')) {
              return 'vendor-bootstrap';
            }
            if (id.includes('clsx') || id.includes('date-fns')) {
              return 'vendor-utils';
            }
            return 'vendor-other';
          }
        },
      },
    } : {},
  },
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:5000",
      "/uploads": "http://localhost:5000",
      "/meta": "http://localhost:5000",
    },
  },
}));