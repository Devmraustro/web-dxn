// ---------------------------------------------------------------------------
// DXN Store — Admin provisioning + catalog seed (out-of-band CLI)
//
// Usage:
//   npm run seed                           # both admin + catalog
//   npm run seed -- --admin                # admin only
//   npm run seed -- --catalog              # catalog only
//   npm run seed -- --admin --reset        # also reset existing admin password
//   npm run seed -- --cleanup              # delete placeholder/seed catalog only
//
// Environment file precedence (deterministic):
//   1. `.env.production.local`  (used when present — production provisioning)
//   2. `.env`                   (local development fallback)
//   3. current `process.env`    (shell / CI values always win over files)
//
// Required env:
//   MONGODB_URI          target database
//   ADMIN_EMAIL          owner / admin email
//   ADMIN_PASSWORD       plaintext password (hashed before storage)
//
// Optional env:
//   ADMIN_ROLE           "owner" (default) | "admin"
//   SEED_ENV_FILE        override the env file path (advanced)
//
// Safety:
//   - Environment files are read with dotenv.parse; loadSeedEnv() never
//     overrides variables already present in process.env.
//   - preflightSeed() rejects localhost, bad schemes, missing/placeholder/
//     redacted credentials BEFORE connecting — and never prints values.
//   - Passwords are NEVER logged.
//   - Existing passwords are never changed unless --reset is explicitly set.
//   - Existing roles are never downgraded (owner always stays owner).
//   - Catalog inserts are idempotent — existing products/packs/offers are
//     never overwritten.
// ---------------------------------------------------------------------------
//
// NOTE: no `import "dotenv/config"` here. That preloads `.env` (dev/localhost)
// before `loadSeedEnv()` runs, so the production file would be ignored. The
// deterministic precedence is handled entirely by `loadSeedEnv()` below.

import path from "path";
import mongoose from "mongoose";
import { provisionAdminUser, seedStarterCatalog } from "../services/bootstrap.service";
import { removePlaceholderCatalog } from "../services/catalogCleanup.service";
import {
  describeSeedEnvFile,
  loadSeedEnv,
  preflightSeed,
  PREFLIGHT_MESSAGES,
  type SeedPreflight,
} from "./seedEnv";

/* ---- CLI args -------------------------------------------------------- */

const args = new Set(process.argv.slice(2));
const wantsCleanup = args.has("--cleanup");
const wantsAdmin = (args.has("--admin") || !args.has("--catalog")) && !wantsCleanup;
const wantsCatalog = (args.has("--catalog") || !args.has("--admin")) && !wantsCleanup;
const wantsReset = args.has("--reset");

/* ---- helpers --------------------------------------------------------- */

function exit(code: number, msg: string): never {
  console.error(`\n❌ ${msg}`);
  process.exit(code);
}

function log(msg: string) {
  console.log(`  ${msg}`);
}

/* ---- main ------------------------------------------------------------ */

async function main() {
  // --- load env deterministically (production-local file preferred) ---
  const { file: envFile, overridden } = loadSeedEnv();
  if (envFile) {
    log(`Loaded env: ${describeSeedEnvFile(envFile)}`);
    if (overridden.length > 0) {
      // Variables already in process.env were kept — never silently swapped.
      log(`Envvars already present in process.env (not overridden): ${overridden.length}`);
    }
  } else {
    log("No .env file found — relying on process environment only.");
  }

  // --- preflight (non-sensitive, before any connection) ---
  const role = process.env.ADMIN_ROLE === "admin" ? "admin" : "owner";
  // Production intent = a non-`.env` env file (`.env.production.local` or an
  // explicit SEED_ENV_FILE override) is in use; localhost is then forbidden.
  // The plain development `.env` keeps localhost allowed for local seeding.
  const prodFileInUse = !!envFile && path.basename(envFile) !== ".env";
  const preflight: SeedPreflight = {
    uri: process.env.MONGODB_URI,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    requireAdmin: wantsAdmin,
    forbidLocalhost: prodFileInUse,
  };

  const violations = preflightSeed(preflight);
  if (violations.length > 0) {
    console.log("\n🔎 Preflight rejected the provisioning request:");
    for (const v of violations) {
      log(`- ${PREFLIGHT_MESSAGES[v]}`);
    }
    exit(
      1,
      "Preflight failed — fix the variables above (values are never displayed), then re-run."
    );
  }

  const uri = process.env.MONGODB_URI as string;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  // --- connect ---
  console.log("\n🔗 Connecting to MongoDB…");
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
  });
  console.log("   Connected.\n");

  // --- placeholder cleanup mode ---
  if (wantsCleanup) {
    console.log("🗑️  Removing placeholder/seed catalog records…");
    const report = await removePlaceholderCatalog();
    log(`Products:  ${report.productsDeleted} deleted`);
    log(`Packs:     ${report.packsDeleted} deleted`);
    log(`Offers:    ${report.offersDeleted} deleted`);
    log(`Translations: ${report.translationsDeleted} deleted`);
    log(`Pack items:   ${report.packItemsDeleted} deleted`);
    if (!report.cleaned) log("(no placeholder records found — already clean)");
    console.log();
  }

  // --- provision admin ---
  if (wantsAdmin && email && password) {
    console.log("👤 Provisioning admin account…");
    const res = await provisionAdminUser({
      email,
      password,
      role,
      resetPassword: wantsReset,
    });

    if (res.created) {
      log(`Created ${role} — ${res.email}`);
    } else {
      log(`Already exists — ${res.email}`);
      if (res.roleChanged) {
        log(`   Role upgraded ${res.previousRole} → ${role}`);
      }
      if (wantsReset) {
        log("   Password has been reset");
      }
    }
    console.log();
  }

  // --- seed catalog ---
  if (wantsCatalog) {
    console.log("📦 Seeding starter catalog…");
    const res = await seedStarterCatalog();
    log(
      `Products: ${res.productsCreated} created, ${res.productsSkipped} skipped`
    );
    log(
      `Packs:    ${res.packsCreated} created, ${res.packsSkipped} skipped`
    );
    log(
      `Offers:   ${res.offersCreated} created, ${res.offersSkipped} skipped`
    );
    console.log();
  }

  await mongoose.disconnect();
  console.log("✅ Done.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err?.message ?? err);
  void mongoose.disconnect().catch(() => {});
  process.exit(1);
});