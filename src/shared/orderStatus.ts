/**
 * Canonical order-status model — single source of truth for the order
 * lifecycle. The backend transition guard (`order.controller.ts`), the seller
 * AI knowledge and the admin UI (status dropdowns / badges) all derive their
 * allowed transitions and terminal statuses from THIS module, so the UI can
 * never offer a transition the backend would reject.
 *
 * Statuses:
 *   new            — just placed by the customer
 *   pending_payment— awaiting payment (legacy BaridiMob flows; new COD orders
 *                    skip straight to `confirmed` via the explicit transition)
 *   confirmed      — verified by the seller
 *   processing     — being prepared
 *   shipped        — handed to the carrier
 *   delivered      — terminal, delivered
 *   cancelled      — terminal, order void
 *   rejected       — terminal, order refused
 */

export const ORDER_STATUSES = [
  "new",
  "pending_payment",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "rejected",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Allowed `from -> to` transitions. The backend enforces exactly these. */
export const VALID_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ["pending_payment", "confirmed", "cancelled"],
  pending_payment: ["confirmed", "rejected", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  rejected: [],
};

/** Terminal statuses that free the reserved inventory again. */
export const RESTOCK_ON_STATUS: ReadonlySet<OrderStatus> = new Set([
  "cancelled",
  "rejected",
]);

/** Statuses with no outgoing transitions (already terminal). */
export const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set(
  ORDER_STATUSES.filter((s) => VALID_TRANSITIONS[s].length === 0)
);

export function isKnownStatus(status: string): status is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(status);
}

/** Safe accessor for string-typed DB / API values (never throws on unknown). */
export function getValidTransitions(status: string): readonly OrderStatus[] {
  return isKnownStatus(status) ? VALID_TRANSITIONS[status] : [];
}

/** Backend-style check: is `to` an allowed transition from `from`? */
export function canTransition(from: string, to: string): boolean {
  return getValidTransitions(from).includes(to as OrderStatus);
}

/** Whether this status frees reserved inventory (restock on reach). */
export function isRestockStatus(status: string): boolean {
  return RESTOCK_ON_STATUS.has(status as OrderStatus);
}