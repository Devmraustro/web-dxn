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
    // Rolling our own chunking with `manualChunks` substring matching
    // (`id.includes('react')`) forced every React-adjacent package —
    // react-dom, react-router, react-i18next, react-bootstrap,
    // react-helmet-async — into one long-lived `vendor-react` chunk whose
    // module set (and therefore its content-hashed file name) stayed stable
    // across releases while its cross-chunk export table was recomputed from
    // whatever the application chunks happened to import. It also duplicated
    // React's core module into a second vendor chunk. A stale copy of such a
    // shared chunk at an immutable `/assets/*` URL is enough to make the whole
    // module graph unlinkable and blank the page before React mounts
    // ("does not provide an export named 'k'").
    //
    // The bundler now derives chunk boundaries from the real module graph, so
    // every chunk name is content-addressed over exactly the code it contains
    // and no chunk carries a hand-maintained "public API" of renamed exports.
    // Bundle integrity is enforced after every build by
    // scripts/check-bundle-integrity.mjs.
    rollupOptions: command === "build" ? { output: {} } : {},
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    proxy: {
      "/api": "http://localhost:5000",
      "/uploads": "http://localhost:5000",
      "/meta": "http://localhost:5000",
    },
  },
}));
