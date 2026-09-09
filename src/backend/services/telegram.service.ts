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
}

function isConfigured(): boolean {
  return !!readToken() && !!readChatId();
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
  } catch (err) {
    return {
      delivered: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function buildOrderMessage(order: any): string {
  const itemsText = (order.items || [])
    .map((item: any) => {
      const name = item.productName || item.packName || "Product";
      return `- ${name} x${item.quantity || 1}`;
    })
    .join("\n");

  const paymentText =
    order.paymentMethod === "cod"
      ? "Cash on Delivery"
      : "BaridiMob — payment verification required";

  const deliveryText = order.deliveryMethod === "home" ? "Home delivery" : "Office delivery";

  const lines = [
    "📦 *NEW ORDER*",
    "",
    `Order: ${order.orderNumber}`,
    "",
    "Customer:",
    `${order.customerInfo.firstName} ${order.customerInfo.lastName}`,
    `Phone: ${order.customerInfo.phone}`,
    order.customerInfo.secondPhone ? `Second phone: ${order.customerInfo.secondPhone}` : "",
    `Wilaya: ${order.customerInfo.wilaya}`,
    `Delivery: ${deliveryText}`,
    order.deliveryMethod === "home" && order.customerInfo.address
      ? `Address: ${order.customerInfo.address}`
      : "",
    "",
    "Products:",
    itemsText,
    "",
    `Subtotal: ${order.subtotal} DA`,
    `Shipping: ${order.shippingFee} DA`,
    `Total: ${order.total} DA`,
    "",
    `Payment: ${paymentText}`,
  ].filter((l) => l !== "");

  return lines.join("\n");
}

function buildStatusMessage(order: any, statusText: string): string {
  const statusMap: Record<string, string> = {
    confirmed: "✅ Order confirmed",
    processing: "🔄 Order processing",
    shipped: "🚚 Order shipped",
    delivered: "✅ Order delivered",
    cancelled: "❌ Order cancelled",
    rejected: "❌ Order rejected",
  };
  const head = statusMap[order.status] || "ℹ️ Order status updated";
  return [
    `*${head}*`,
    "",
    `Order: ${order.orderNumber}`,
    `Status: ${statusText}`,
    "",
    `Customer: ${order.customerInfo.firstName} ${order.customerInfo.lastName}`,
    `Phone: ${order.customerInfo.phone}`,
  ].join("\n");
}

function buildBaridiMessage(order: any): string {
  return [
    "💳 *BaridiMob Payment Verification Required*",
    "",
    `Order: ${order.orderNumber}`,
    `Customer: ${order.customerInfo.firstName} ${order.customerInfo.lastName}`,
    `Phone: ${order.customerInfo.phone}`,
    `Total: ${order.total} DA`,
    "",
    "The owner must verify the BaridiMob payment manually.",
    "Contact the customer to confirm payment completion.",
  ].join("\n");
}

function buildEscalationMessage(order: any, reason: string, customerInfo: any): string {
  return [
    "⚠️ *ESCALATION TO OWNER*",
    "",
    `Order: ${order.orderNumber}`,
    `Reason: ${reason}`,
    "",
    "Customer:",
    `Name: ${customerInfo.firstName} ${customerInfo.lastName}`,
    `Phone: ${customerInfo.phone}`,
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

export async function sendBaridiMobVerificationNotice(order: any): Promise<TelegramSendResult> {
  return sendMessage(buildBaridiMessage(order));
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
  sendBaridiMobVerificationNotice,
  sendEscalationNotification,
  telegramSinkAdapter,
  isTelegramConfigured,
};
