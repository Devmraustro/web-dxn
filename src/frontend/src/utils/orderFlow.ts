/**
 * Pure order-submission outcome helpers.
 *
 * The order success screen must appear ONLY after a confirmed successful
 * backend order creation (HTTP 2xx + `success: true`). It must never claim a
 * payment was completed, an order was shipped, or that staff already confirmed
 * it — the copy below only promises contact to confirm the order.
 */

export type UiLanguage = "ar" | "fr";

export interface OrderSubmitOutcome {
  /** True ONLY on a backend-confirmed successful creation (2xx + success). */
  showSuccess: boolean;
  orderNumber?: string;
  errorMessage?: string;
}

export interface OrderCreateResponseLike {
  success?: boolean;
  data?: { orderNumber?: string };
  message?: string;
}

export const ORDER_SUCCESS_COPY: Record<UiLanguage, { title: string; body: string }> = {
  ar: {
    title: "تم إرسال طلبك بنجاح 🎉",
    body: "سنتواصل معك ونرد عليك في أقرب وقت لتأكيد طلبك.",
  },
  fr: {
    title: "Votre commande a été envoyée avec succès 🎉",
    body: "Nous vous contacterons dans les plus brefs délais pour confirmer votre commande.",
  },
};

export function orderSuccessCopy(language: UiLanguage): { title: string; body: string } {
  return ORDER_SUCCESS_COPY[language];
}

/**
 * Decide the post-submit state from the raw HTTP status and payload.
 * Success requires BOTH a 2xx status AND `body.success === true` — a 500 that
 * happens to carry `success: true`, or a 2xx wrapper that did not set success,
 * never shows the success screen.
 */
export function resolveOrderOutcome(
  httpStatus: number,
  body: OrderCreateResponseLike,
  language: UiLanguage,
  fallbackErrorMessage: string
): OrderSubmitOutcome {
  const ok = httpStatus >= 200 && httpStatus < 300 && body?.success === true;
  if (ok) {
    return {
      showSuccess: true,
      orderNumber: body?.data?.orderNumber,
    };
  }
  return {
    showSuccess: false,
    errorMessage:
      (typeof body?.message === "string" && body.message.trim() ? body.message : "") ||
      fallbackErrorMessage,
  };
}

export default {
  orderSuccessCopy,
  resolveOrderOutcome,
  ORDER_SUCCESS_COPY,
};