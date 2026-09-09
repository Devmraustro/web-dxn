/**
 * Server-authoritative commerce math.
 *
 * All monetary calculations that must never be influenced by client input
 * live here as pure functions so they can be unit-tested without a database.
 *
 * The server is the ONLY source of truth for prices, stock, quantities,
 * shipping and discounts. Client-supplied `unitPrice`/`total` values are never
 * used to compute an order — they only exist so the client can render a
 * provisional estimate.
 */

export class OrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderValidationError";
  }
}

/** Round to the smallest DA unit (2 decimals keeps float drift in check). */
export const roundMoney = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Validate and normalize a line quantity coming from the client.
 * Rejects NaN / Infinity / non-integer / zero / negative / absurd values.
 */
export function normalizeQuantity(q: unknown): number {
  const n = typeof q === "string" ? Number(q) : q;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new OrderValidationError("Quantity must be a finite number");
  }
  if (!Number.isInteger(n) || n < 1) {
    throw new OrderValidationError("Quantity must be a positive integer");
  }
  if (n > 999) {
    throw new OrderValidationError("Quantity is too large (max 999 per line)");
  }
  return n;
}

/** Validate a server-side unit price is a sane non-negative number. */
export function assertValidUnitPrice(price: unknown): number {
  const n = typeof price === "string" ? Number(price) : price;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) {
    throw new OrderValidationError("Unit price must be a non-negative finite number");
  }
  return roundMoney(n);
}

export interface ResolvedLine {
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

/**
 * Compute the authoritative total for one resolved cart line. quantity is
 * validated (positive integer, bounded) and the total is derived from the
 * server-side unit price only.
 */
export function lineTotal(unitPrice: number, quantity: unknown): ResolvedLine {
  const qty = normalizeQuantity(quantity);
  const price = assertValidUnitPrice(unitPrice);
  return {
    unitPrice: price,
    quantity: qty,
    totalPrice: roundMoney(price * qty),
  };
}

export type OfferType = "percentage" | "fixed";

/**
 * Discount contributed by a single active offer for a single line.
 * The discount is always derived from the SERVER-side line subtotal, never
 * from any client-provided unitPrice. Percentage discounts are computed
 * against the line subtotal and the whole discount is capped at that subtotal
 * so a store can never go below zero because of a discount.
 */
export function offerDiscountForLine(
  lineSubtotal: number,
  offerType: OfferType,
  offerValue: number
): number {
  const value = Number(offerValue);
  if (!Number.isFinite(value) || value < 0) return 0;
  if (offerType === "percentage") {
    const pct = Math.min(value, 100);
    return roundMoney(Math.min(lineSubtotal, (lineSubtotal * pct) / 100));
  }
  if (offerType === "fixed") {
    return roundMoney(Math.min(lineSubtotal, value));
  }
  return 0;
}

/**
 * Final order total. Never allowed to go negative: subtotal + shipping minus
 * (capped) discount, floored at zero.
 */
export function finalTotal(subtotal: number, shippingFee: number, discount: number): number {
  const s = roundMoney(subtotal);
  const f = roundMoney(shippingFee);
  const d = Math.max(0, roundMoney(discount));
  return roundMoney(Math.max(0, s + f - d));
}

export default {
  OrderValidationError,
  roundMoney,
  normalizeQuantity,
  assertValidUnitPrice,
  lineTotal,
  offerDiscountForLine,
  finalTotal,
};
