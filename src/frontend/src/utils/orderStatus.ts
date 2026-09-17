import type { OrderStatus } from "../../../shared/orderStatus";
import {
  ORDER_STATUSES,
  VALID_TRANSITIONS,
  TERMINAL_STATUSES,
  getValidTransitions,
} from "../../../shared/orderStatus";

/**
 * Admin UI presentation layer for order statuses.
 *
 * The status VALUES and allowed TRANSITIONS are imported verbatim from
 * `src/shared/orderStatus` — the same module the backend transition guard
 * enforces — so the dropdowns can never offer a transition the backend would
 * reject. Only the human-facing labels (AR/FR) and Bootstrap badge variants
 * are defined here.
 */
export { ORDER_STATUSES, TERMINAL_STATUSES, getValidTransitions };
export type { OrderStatus };

/** Bilingual labels `[ar, fr]` — one entry per canonical status value. */
export const STATUS_LABELS: Record<OrderStatus, [string, string]> = {
  new: ["جديدة", "Nouvelle"],
  pending_payment: ["بانتظار الدفع", "Paiement en attente"],
  confirmed: ["مؤكدة", "Confirmée"],
  processing: ["قيد التجهيز", "En préparation"],
  shipped: ["تم الشحن", "Expédiée"],
  delivered: ["تم التسليم", "Livrée"],
  cancelled: ["ملغاة", "Annulée"],
  rejected: ["مرفوضة", "Rejetée"],
};

/** Bootstrap badge variant per status (same mapping everywhere in the admin). */
export const STATUS_VARIANTS: Record<OrderStatus, string> = {
  new: "info",
  pending_payment: "warning",
  confirmed: "primary",
  processing: "secondary",
  shipped: "dark",
  delivered: "success",
  cancelled: "danger",
  rejected: "danger",
};

/** Valid transitions map — identical to the backend `VALID_TRANSITIONS`. */
export const NEXT_STATUSES: Record<OrderStatus, readonly OrderStatus[]> =
  VALID_TRANSITIONS;

/** Type-safe accessor for string-typed API status values. */
export function statusLabel(status: string, language: string): string {
  const pair = STATUS_LABELS[status as OrderStatus];
  if (!pair) return status || "—";
  return language === "ar" ? pair[0] : pair[1];
}

/** Type-safe accessor for string-typed API status values. */
export function statusVariant(status: string): string {
  return STATUS_VARIANTS[status as OrderStatus] || "secondary";
}

/** Type-safe accessor for string-typed API status values. */
export function nextStatuses(status: string): readonly OrderStatus[] {
  return getValidTransitions(status);
}