// Repair polluted product slugs (dry-run by default).
//
// Usage:
//   ts-node -P src/backend/tsconfig.json \
//     src/backend/scripts/repairProductSlugs.ts              # dry-run (safe)
//   ts-node -P src/backend/tsconfig.json \
//     src/backend/scripts/repairProductSlugs.ts --apply      # write changes
//
// Env (via loadSeedEnv, deterministic precedence like seed.ts):
//   MONGODB_URI   target database (required, never localhost when a
//                 non-`.env` production file is in use)
//
// Safety guarantees (implemented, not aspirational):
//   - default mode is DRY-RUN: prints the plan and writes nothing
//   - only the `slug` field is ever modified via a scoped $set
//   - no record is ever deleted; unreachable/ambiguous rows are left untouched
//   - valid slugs are never overwritten and never reallocated to another row
//   - idempotent: re-running after --apply yields an all-"keep" plan
//   - collision-safe: every generated slug is unique within the database and
//     against the reserved starter-catalog slugs

import path from "path";
import mongoose from "mongoose";
import {
  loadSeedEnv,
  preflightSeed,
  PREFLIGHT_MESSAGES,
  type SeedPreflight,
} from "./seedEnv";
import {
  buildProductSlugPlan,
  type ProductSlugRow,
} from "../utils/slug";
import { PLACEHOLDER_PRODUCT_IDENTIFIERS } from "../services/placeholderCatalog.service";
import { Product, ProductTranslation } from "../../Database/Models";

const args = new Set(process.argv.slice(2));
const wantsApply = args.has("--apply");

function exit(code: number, msg: string): never {
  console.error(`\n❌ ${msg}`);
  process.exit(code);
}

function log(msg: string) {
  console.log(`  ${msg}`);
}

async function main() {
  const { file: envFile } = loadSeedEnv();
  if (envFile) {
    log(`Loaded env: ${path.basename(envFile)}`);
  } else {
    log("No .env file found — relying on process environment only.");
  }

  const prodFileInUse = !!envFile && path.basename(envFile) !== ".env";
  const preflight: SeedPreflight = {
    uri: process.env.MONGODB_URI,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    requireAdmin: false,
    forbidLocalhost: prodFileInUse,
  };

  const violations = preflightSeed(preflight);
  if (violations.length > 0) {
    console.log("\n🔎 Preflight rejected the repair request:");
    for (const v of violations) {
      log(`- ${PREFLIGHT_MESSAGES[v]}`);
    }
    exit(1, "Preflight failed — fix the variables above, then re-run.");
  }

  const uri = process.env.MONGODB_URI as string;

  console.log("\n🔗 Connecting to MongoDB…");
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
  });
  console.log("   Connected.\n");

  // Load every product plus its ar/fr titles, regardless of isActive, so the
  // repair covers hidden/inactive rows too (the public endpoint cannot).
  const products: any[] = await Product.find({}).sort({ _id: 1 }).lean();
  const translations: any[] = await ProductTranslation.find({
    language: { $in: ["ar", "fr"] },
  }).lean();

  const titleByProduct = new Map<string, { ar?: string; fr?: string }>();
  for (const t of translations) {
    const key = String(t.productId);
    const entry = titleByProduct.get(key) ?? {};
    if (t.language === "ar" && typeof t.title === "string") entry.ar = t.title;
    if (t.language === "fr" && typeof t.title === "string") entry.fr = t.title;
    titleByProduct.set(key, entry);
  }

  const rows: ProductSlugRow[] = products.map((p: any) => {
    const titles = titleByProduct.get(String(p._id)) ?? {};
    return {
      _id: String(p._id),
      sku: typeof p.sku === "string" ? p.sku : undefined,
      slug: typeof p.slug === "string" ? p.slug : "",
      arTitle: titles.ar,
      frTitle: titles.fr,
    };
  });

  const reservedStarter = new Set<string>(PLACEHOLDER_PRODUCT_IDENTIFIERS);
  const plan = buildProductSlugPlan(rows, reservedStarter);

  const keep = plan.filter((e) => e.status === "keep");
  const toRepair = plan.filter((e) => e.status === "repair");
  const toReview = plan.filter((e) => e.status === "review");

  console.log(`📦 Products scanned:   ${rows.length}`);
  console.log(`✅ Already valid:      ${keep.length}`);
  console.log(`🔧 To be repaired:     ${toRepair.length}`);
  console.log(`🧐 Ambiguous (review): ${toReview.length}`);

  console.log("\n────── DRY-RUN PLAN ──────");
  for (const e of toRepair) {
    console.log(
      `\n  ${e.status.toUpperCase()}  [${e.sku ?? "?"}]  ${e.oldSlug}\n      -> ${e.newSlug}` +
        (e.manualReview ? "   (manual review recommended)" : "")
    );
  }
  for (const e of toReview) {
    console.log(`\n  REVIEW  [${e.sku ?? "?"}]  ${e.oldSlug}  — ${e.reason} (left untouched)`);
  }
  console.log("\n──────────────────────────");

  if (!wantsApply) {
    console.log(
      "\nℹ️  DRY-RUN only — nothing was written. Re-run with --apply to perform the repair.\n"
    );
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log("\n✏️  Applying repair…");
  const writes: Array<{
    updateOne: {
      filter: { _id: unknown };
      update: { $set: { slug: string } };
    };
  }> = toRepair.map((e) => ({
    updateOne: {
      filter: { _id: new mongoose.Types.ObjectId(e._id) },
      update: { $set: { slug: e.newSlug as string } },
    },
  }));

  if (writes.length === 0) {
    console.log("   Nothing to write.\n");
  } else {
    const result = await Product.bulkWrite(writes, { ordered: false });
    console.log(`   ${result.modifiedCount} products updated.\n`);
  }

  await mongoose.disconnect();
  console.log("✅ Done.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Repair failed:", err?.message ?? err);
  void mongoose.disconnect().catch(() => {});
  process.exit(1);
});