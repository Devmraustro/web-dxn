import axios, { AxiosError } from "axios";
import { withRetry, RetryOptions } from "../ai/core/retry";

function readToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN;
}
function readChatId(): string | undefined {
  return process.env.TELEGRAM_CHAT_ID;
}

const HTTP_TIMEOUT_MS = 10_000;
const HTTP_MAX_BODY_BYTES = 4_000;

const RETRY: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 4_000,
};

export interface TelegramSendResult {
  delivered: boolean;
  error?: string;
  skipped?: boolean;
  /** HTTP status of the last Telegram API response (present only on failure). */
  status?: number;
}

function isConfigured(): boolean {
  return !!readToken() && !!readChatId();
}

const LEGACY_MARKDOWN_SPECIAL = /([_*`\[])/g;

/**
 * Escape dynamic (user/database-controlled) text for Telegram's legacy
 * "Markdown" parse mode. Only `_`, `*`, `` ` `` and `[` are reserved outside
 * of entities in legacy mode (verified against core.telegram.org — the other
 * documented MarkdownV2-reserved characters pass through literally here), so
 * escaping exactly those four is both necessary and safe. Formatting markers
 * on static labels are intentional and are NOT passed through this helper.
 */
function escapeMarkdown(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(LEGACY_MARKDOWN_SPECIAL, "\\$1");
}

const TOKEN_REDACT_RE = /bot\d{6,}:[A-Za-z0-9_-]{20,}/g;
const MAX_LOGGED_ERROR_LENGTH = 500;

/** Never echo tokens, full URLs or secrets into logs. */
function sanitizeTelegramError(message: string): string {
  return message.replace(TOKEN_REDACT_RE, "bot[redacted]").slice(0, MAX_LOGGED_ERROR_LENGTH);
}

function buildApiUrl(): string {
  const token = readToken();
  if (!token) {
    throw new Error("Telegram not configured");
  }
  return `https://api.telegram.org/bot${token}`;
}

function truncate(text: string, max = HTTP_MAX_BODY_BYTES): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) : text;
}

function isTransient(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError;
    if (ax.response) {
      const status = ax.response.status;
      if (status === 429) return true;
      if (status >= 500 && status <= 599) return true;
      return false;
    }
    if (ax.code && ["ECONNABORTED", "ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN", "EPIPE"].includes(ax.code)) {
      return true;
    }
    return true;
  }
  return false;
}

async function sendMessage(text: string): Promise<TelegramSendResult> {
  if (!isConfigured()) {
    console.info("[telegram] notification skipped: not configured");
    return { delivered: false, skipped: true };
  }
  const url = `${buildApiUrl()}/sendMessage`;
  const body = {
    chat_id: readChatId(),
    text: truncate(text),
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  };
  try {
    await withRetry(
      () =>
        axios.post(url, body, {
          timeout: HTTP_TIMEOUT_MS,
          headers: { "Content-Type": "application/json" },
          maxContentLength: 16_000,
          maxBodyLength: 16_000,
        }),
      { ...RETRY, shouldRetry: isTransient }
    );
    return { delivered: true };
  } catch (err: any) {
    const status = err?.response?.status as number | undefined;
    const error = sanitizeTelegramError(err instanceof Error ? err.message : String(err));
    console.warn(`[telegram] sendMessage failed status=${status ?? "-"} error=${error}`);
    return { delivered: false, error, ...(status !== undefined ? { status } : {}) };
  }
}

/** Stable, human-friendly date formatting for the order notification. */
function formatTelegramDate(value: unknown): string {
  if (!value) return "";
  try {
    const d = new Date(value as any);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "";
  }
}

/**
 * Professional order notification (bilingual AR/FR, legacy Markdown).
 * Only dynamic (user/database-controlled) values pass through escapeMarkdown;
 * static labels are literal formatting. Never fabricated data — every field
 * comes from the persisted order document.
 */
function buildOrderMessage(order: any): string {
  const esc = escapeMarkdown;
  const customer = order.customerInfo || {};

  const itemsText = (order.items || [])
    .map((item: any) => {
      const name = esc(item.productName || item.packName || "Product");
      const qty = item.quantity || 1;
      const unitPrice = item.unitPrice;
      const totalPrice = item.totalPrice;
      if (unitPrice != null && totalPrice != null) {
        return `• ${name} — ${esc(qty)} × ${esc(unitPrice)} DA = ${esc(totalPrice)} DA`;
      }
      if (unitPrice != null) {
        return `• ${name} — ${esc(qty)} × ${esc(unitPrice)} DA`;
      }
      return `• ${name} — ${esc(qty)}`;
    })
    .join("\n");

  const paymentText =
    order.paymentMethod === "cod"
      ? "الدفع عند الاستلام / Paiement à la livraison"
      : esc(order.paymentMethod || "—");
  const deliveryText =
    order.deliveryMethod === "home"
      ? "التوصيل إلى المنزل / Livraison à domicile"
      : order.deliveryMethod === "office"
      ? "التوصيل إلى مكتب البريد / Livraison au bureau de poste"
      : esc(order.deliveryMethod || "—");

  const lines = [
    "🛒 *NEW ORDER*",
    "",
    `Order: ${esc(order.orderNumber)}`,
  ];

  const dateText = formatTelegramDate(order.createdAt);
  if (dateText) lines.push(`Date: ${esc(dateText)}`);

  lines.push(
    "",
    "👤 *Customer / Client*",
    `Name: ${esc(customer.firstName)} ${esc(customer.lastName)}`,
    `Phone: ${esc(customer.phone)}`
  );
  if (customer.secondPhone) lines.push(`Second phone: ${esc(customer.secondPhone)}`);
  if (customer.wilaya) lines.push(`Wilaya: ${esc(customer.wilaya)}`);
  if (order.deliveryMethod === "home" && customer.address) {
    lines.push(`Address: ${esc(customer.address)}`);
  }

  lines.push(
    "",
    "🚚 *Delivery / Livraison*",
    `Method: ${deliveryText}`,
    `Payment: ${paymentText}`,
    "",
    "🛍️ *Items / Articles*",
    itemsText || "• —",
    "",
    "💰 *Summary / Récapitulatif*",
    `Subtotal: ${esc(order.subtotal ?? 0)} DA`,
    `Shipping: ${esc(order.shippingFee ?? 0)} DA`,
    `Total: ${esc(order.total ?? 0)} DA`
  );

  return lines.join("\n");
}

function buildStatusMessage(order: any, statusText: string): string {
  const esc = escapeMarkdown;
  const statusMap: Record<string, string> = {
    confirmed: "✅ Order confirmed",
    processing: "🔄 Order processing",
    shipped: "🚚 Order shipped",
    delivered: "✅ Order delivered",
    cancelled: "❌ Order cancelled",
    rejected: "❌ Order rejected",
  };
  const head = statusMap[order.status] || "ℹ️ Order status updated";
  const customer = order.customerInfo || {};
  return [
    `*${head}*`,
    "",
    `Order: ${esc(order.orderNumber)}`,
    `Status: ${esc(statusText)}`,
    "",
    `Customer: ${esc(customer.firstName)} ${esc(customer.lastName)}`,
    `Phone: ${esc(customer.phone)}`,
  ].join("\n");
}

function buildEscalationMessage(order: any, reason: string, customerInfo: any): string {
  const esc = escapeMarkdown;
  const customer = customerInfo || {};
  return [
    "⚠️ *ESCALATION TO OWNER*",
    "",
    `Order: ${esc(order.orderNumber)}`,
    `Reason: ${esc(reason)}`,
    "",
    "Customer:",
    `Name: ${esc(customer.firstName)} ${esc(customer.lastName)}`,
    `Phone: ${esc(customer.phone)}`,
    "Platform: Web",
    "",
    "Please review and take appropriate action.",
  ].join("\n");
}

export async function sendNewOrderNotification(order: any): Promise<TelegramSendResult> {
  return sendMessage(buildOrderMessage(order));
}

export async function sendTelegramMessage(text: string): Promise<{ ok: boolean; delivered?: boolean; error?: string }> {
  const res = await sendMessage(text);
  return { ok: res.delivered, delivered: res.delivered, error: res.error };
}

export async function sendOrderStatusUpdate(order: any, statusText: string): Promise<TelegramSendResult> {
  return sendMessage(buildStatusMessage(order, statusText));
}

export async function sendEscalationNotification(
  order: any,
  reason: string,
  customerInfo: any
): Promise<TelegramSendResult> {
  return sendMessage(buildEscalationMessage(order, reason, customerInfo));
}

/**
 * Adapter implementing the AI orchestrator's TelegramSink interface so the
 * human-handoff pipeline can notify the owner using the same bounded-retry
 * delivery path.
 */
export const telegramSinkAdapter = {
  async send(message: string): Promise<unknown> {
    const res = await sendMessage(message);
    if (!res.delivered && !res.skipped) {
      throw new Error(res.error || "Telegram delivery failed");
    }
    return res;
  },
};

export function isTelegramConfigured(): boolean {
  return isConfigured();
}

export default {
  sendNewOrderNotification,
  sendOrderStatusUpdate,
  sendEscalationNotification,
  telegramSinkAdapter,
  isTelegramConfigured,
};
