/**
 * Pure, DB-free cart reconciliation.
 *
 * A persisted cart may hold products that are no longer purchasable:
 *  - nonexistent (deleted / never existed),
 *  - inactive (admin deactivated them),
 *  - placeholder seed records (hidden from the public catalog),
 *  - out of stock / quantity exceeding the authoritative stock.
 *
 * The PUBLIC catalog endpoints (/api/products, /api/packs) only ever return
 * active, non-placeholder records, so any cart id that is missing from that
 * authoritative list is by definition stale/inactive/placeholder, and any id
 * whose authoritative stock is exhausted is unavailable.
 *
 * This module holds NO I/O: the caller fetches the authoritative lists and the
 * component layer renders the result. It is unit-tested without a database.
 */

import type { CartItem } from "../context/CartContext";

export type CartItemStatus = "ok" | "stale" | "unavailable";

export type CartItemReason =
  | "missing" // nonexistent / inactive / placeholder (not in the public catalog)
  | "out-of-stock" // authoritative stock is 0
  | "quantity-exceeds-stock"; // cart quantity > authoritative stock

export interface CatalogEntry {
  id: string;
  price: number;
  stockQuantity: number;
  name?: string;
}

export interface ReconcileItem extends CartItem {
  status: CartItemStatus;
  reasons: CartItemReason[];
}

export interface ReconcileResult {
  items: ReconcileItem[];
  subtotal: number;
  validCount: number;
  invalidCount: number;
}

export const roundMoney = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const isProductEntry = (item: CartItem): item is CartItem & { productId: string } =>
  typeof item.productId === "string" && item.productId.length > 0;

const isPackEntry = (item: CartItem): item is CartItem & { packId: string } =>
  typeof item.packId === "string" && item.packId.length > 0;

/**
 * Refresh prices/names to authoritative catalog values and classify every line.
 *
 * `catalogAvailable` distinguishes "the authoritative list was fetched and is
 * genuinely short" from "the fetch failed" — when the list is unavailable we
 * must never mark a real cart as stale (the backend remains the final safety
 * boundary in that case), so every line is left "ok".
 */
export function reconcileCart(
  preparedItems: ReadonlyArray<CartItem>,
  productsById: ReadonlyMap<string, CatalogEntry>,
  packsById: ReadonlyMap<string, CatalogEntry>,
  catalogAvailable = true
): ReconcileResult {
  if (!catalogAvailable) {
    const neutral: ReconcileItem[] = preparedItems.map((item) => ({
      ...item,
      status: "ok" as const,
      reasons: [],
    }));
    return {
      items: neutral,
      subtotal: roundMoney(neutral.reduce((sum, it) => sum + Number(it.totalPrice || 0), 0)),
      validCount: neutral.length,
      invalidCount: 0,
    };
  }

  const items: ReconcileItem[] = [];

  for (const item of preparedItems) {
    if (isProductEntry(item)) {
      const entry = productsById.get(item.productId);
      if (!entry) {
        items.push({ ...item, status: "stale", reasons: ["missing"] });
        continue;
      }
      const reasons: CartItemReason[] = [];
      const stock = Number(entry.stockQuantity);
      const quantity = Number(item.quantity);
      if (!Number.isFinite(stock) || stock <= 0) {
        reasons.push("out-of-stock");
      } else if (Number.isFinite(quantity) && quantity > stock) {
        reasons.push("quantity-exceeds-stock");
      }
      items.push({
        ...item,
        name: entry.name || item.name,
        unitPrice: Number(entry.price),
        totalPrice: roundMoney(Number(entry.price) * quantity),
        status: reasons.length > 0 ? "unavailable" : "ok",
        reasons,
      });
      continue;
    }

    if (isPackEntry(item)) {
      const entry = packsById.get(item.packId);
      if (!entry) {
        items.push({ ...item, status: "stale", reasons: ["missing"] });
        continue;
      }
      items.push({
        ...item,
        name: entry.name || item.name,
        unitPrice: Number(entry.price),
        totalPrice: roundMoney(Number(entry.price) * Number(item.quantity)),
        status: "ok",
        reasons: [],
      });
      continue;
    }

    // Malformed line without any identifier — cannot be checked, keep as stale.
    items.push({ ...item, status: "stale", reasons: ["missing"] });
  }

  const valid = items.filter((it) => it.status === "ok");
  const subtotal = roundMoney(valid.reduce((sum, it) => sum + Number(it.totalPrice || 0), 0));

  return {
    items,
    subtotal,
    validCount: valid.length,
    invalidCount: items.length - valid.length,
  };
}

/** Narrow a ReconcileResult to the items currently blocking checkout. */
export function invalidItemsOf(result: ReconcileResult): ReconcileItem[] {
  return result.items.filter((it) => it.status !== "ok");
}

export default reconcileCart;