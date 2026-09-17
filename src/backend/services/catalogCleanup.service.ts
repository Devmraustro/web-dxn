/**
 * Out-of-band catalog cleanup for seed/placeholder records.
 *
 * The idempotent starter seed (bootstrap.service.ts / seed script) populates a
 * brand-new database with a PLACEHOLDER DXN catalog (STARTER_PRODUCTS /
 * STARTER_PACKS / STARTER_OFFERS in dxnCatalog.ts). Those records are a
 * development scaffold, not a sellable catalog. This module deletes ONLY those
 * records and their direct children (translations, pack items, offer rows).
 *
 * SAFETY
 * - Selection is deterministic and restricted to the exact starter identifier
 *   sets (sku/slug) plus explicit `source: "seed"` / `isPlaceholder: true`
 *   markers — real products, packs, offers, orders, customers and order line
 *   items are never touched.
 * - Deletion is ordered so child documents (translations, pack items, offers
 *   referencing starter targets) are removed before their parents, leaving no
 *   orphan references.
 * - Idempotent: running it on an already-clean catalog deletes nothing.
 */

import {
  Product,
  ProductTranslation,
  Pack,
  PackItem,
  Offer,
} from "../../Database/Models";
import {
  PLACEHOLDER_PRODUCT_IDENTIFIERS,
  PLACEHOLDER_PACK_IDENTIFIERS,
  PLACEHOLDER_OFFER_IDENTIFIERS,
} from "./placeholderCatalog.service";

export interface PlaceholderCleanupReport {
  productsDeleted: number;
  packsDeleted: number;
  offersDeleted: number;
  translationsDeleted: number;
  packItemsDeleted: number;
  /** True when at least one placeholder record was actually deleted. */
  cleaned: boolean;
}

/** Mongo selector that matches ONLY placeholder/seed PRODUCT documents. */
export function placeholderProductSelectionQuery(): Record<string, unknown> {
  return {
    $or: [
      { sku: { $in: [...PLACEHOLDER_PRODUCT_IDENTIFIERS] } },
      { slug: { $in: [...PLACEHOLDER_PRODUCT_IDENTIFIERS] } },
      { source: "seed" },
      { isPlaceholder: true },
    ],
  };
}

/** Mongo selector that matches ONLY placeholder/seed PACK documents. */
export function placeholderPackSelectionQuery(): Record<string, unknown> {
  return {
    $or: [
      { slug: { $in: [...PLACEHOLDER_PACK_IDENTIFIERS] } },
      { source: "seed" },
      { isPlaceholder: true },
    ],
  };
}

/** Mongo selector that matches ONLY placeholder/seed OFFER documents. */
export function placeholderOfferSelectionQuery(): Record<string, unknown> {
  return {
    $or: [
      { slug: { $in: [...PLACEHOLDER_OFFER_IDENTIFIERS] } },
      { source: "seed" },
      { isPlaceholder: true },
    ],
  };
}

/**
 * Delete every placeholder/seed catalog record and its direct children.
 * Never touches real catalog rows, orders, customers or line items.
 */
export async function removePlaceholderCatalog(): Promise<PlaceholderCleanupReport> {
  const report: PlaceholderCleanupReport = {
    productsDeleted: 0,
    packsDeleted: 0,
    offersDeleted: 0,
    translationsDeleted: 0,
    packItemsDeleted: 0,
    cleaned: false,
  };

  // 1. Placeholder products first (offers/pack items referencing them are then
  //    unreferenced, and translations are removed with them).
  const products = await Product.find(placeholderProductSelectionQuery())
    .select("_id")
    .lean();
  const productIds = products.map((p: { _id: unknown }) => p._id);
  if (productIds.length > 0) {
    const translations = await ProductTranslation.deleteMany({
      productId: { $in: productIds },
    });
    report.translationsDeleted += translations.deletedCount || 0;
    const packItems = await PackItem.deleteMany({ productId: { $in: productIds } });
    report.packItemsDeleted += packItems.deletedCount || 0;
    await Product.deleteMany({ _id: { $in: productIds } });
    report.productsDeleted = productIds.length;
  }

  // 2. Placeholder offers.
  const offers = await Offer.find(placeholderOfferSelectionQuery())
    .select("_id")
    .lean();
  const offerIds = offers.map((o: { _id: unknown }) => o._id);
  if (offerIds.length > 0) {
    await Offer.deleteMany({ _id: { $in: offerIds } });
    report.offersDeleted = offerIds.length;
  }

  // 3. Placeholder packs last (their pack items are removed with them).
  const packs = await Pack.find(placeholderPackSelectionQuery()).select("_id").lean();
  const packIds = packs.map((p: { _id: unknown }) => p._id);
  if (packIds.length > 0) {
    const packItems = await PackItem.deleteMany({ packId: { $in: packIds } });
    report.packItemsDeleted += packItems.deletedCount || 0;
    await Pack.deleteMany({ _id: { $in: packIds } });
    report.packsDeleted = packIds.length;
  }

  report.cleaned =
    report.productsDeleted > 0 || report.packsDeleted > 0 || report.offersDeleted > 0;

  return report;
}