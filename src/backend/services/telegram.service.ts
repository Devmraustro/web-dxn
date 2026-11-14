import axios, { AxiosError } from "axios";
import mongoose from "mongoose";
import * as Models from "../../Database/Models";
import { withRetry, RetryOptions } from "../ai/core/retry";

function readToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN;
}
function readChatId(): string | undefined {
  return process.env.TELEGRAM_CHAT_ID;
}

const HTTP_TIMEOUT_MS = 10_000;
const HTTP_MAX_BODY_BYTES = 4_000;
const MAX_DEDUP_CACHE_SIZE = 1_000;

const RETRY: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 4_000,
};

export interface TelegramSendResult {
  delivered: boolean;
  error?: string;
  skipped?: boolean;
  duplicate?: boolean;
  /** HTTP status of the last Telegram API response (present only on failure). */
  status?: number;
}

const deliveredDedupKeys = new Set<string>();

export function resetTelegramDedupCacheForTests(): void {
  deliveredDedupKeys.clear();
}

function rememberDeliveredKey(dedupKey: string): void {
  if (!dedupKey) return;
  if (deliveredDedupKeys.size >= MAX_DEDUP_CACHE_SIZE) {
    const oldest = deliveredDedupKeys.values().next().value;
    if (oldest) deliveredDedupKeys.delete(oldest);
  }
  deliveredDedupKeys.add(dedupKey);
}

function isNotificationDbAvailable(Model: any): boolean {
  if (!Model || typeof Model.create !== "function") return false;
  if ((Model.create as any)._isMockFunction) return true;
  return Boolean(Model.db && mongoose.connection?.readyState === 1);
}

async function wasAlreadyDelivered(dedupKey?: string): Promise<boolean> {
  if (!dedupKey) return false;
  if (deliveredDedupKeys.has(dedupKey)) return true;
  try {
    const NotificationLogModel = (Models as any).NotificationLog;
    if (!isNotificationDbAvailable(NotificationLogModel) || typeof NotificationLogModel.findOne !== "function") {
      return false;
    }
    const query = NotificationLogModel.findOne({ dedupKey, delivered: true });
    const existing = query && typeof query.lean === "function" ? await query.lean() : await query;
    if (existing) {
      rememberDeliveredKey(dedupKey);
      return true;
    }
  } catch {
    // Non-fatal
  }
  return false;
}

async function persistNotificationLog(params: {
  dedupKey?: string;
  eventType: "new_order" | "order_status" | "new_lead" | "new_contact" | "escalation";
  referenceId: string;
  result: TelegramSendResult;
  attempts: number;
}): Promise<void> {
  try {
    const NotificationLogModel = (Models as any).NotificationLog;
    if (!isNotificationDbAvailable(NotificationLogModel)) return;
    await NotificationLogModel.create({
      ...(params.result.delivered && params.dedupKey ? { dedupKey: params.dedupKey } : {}),
      eventType: params.eventType,
      referenceId: String(params.referenceId || "unknown"),
      delivered: Boolean(params.result.delivered),
      skipped: Boolean(params.result.skipped),
      attempts: params.attempts,
      ...(params.result.status !== undefined ? { httpStatus: params.result.status } : {}),
      errorSummary: params.result.error || "",
    });
  } catch {
    // Best-effort log; never fail caller
  }
}

function isConfigured(): boolean {
  return !!readToken() && !!readChatId();
}

const LEGACY_MARKDOWN_SPECIAL = /([_*`\[])/g;

/**
 * Escape dynamic (user/database-controlled) text for Telegram's legacy
 * "Markdown" parse mode. Only `_`, `*`, `` ` `` and `[` are reserved outside
 * of entities in legacy mode.
 */
export function escapeTelegramMarkdown(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(LEGACY_MARKDOWN_SPECIAL, "\\$1");
}

const escapeMarkdown = escapeTelegramMarkdown;

const TOKEN_REDACT_RE = /bot\d{4,}:[A-Za-z0-9_-]{8,}/g;
const URL_BOT_PATH_REDACT_RE = /\/bot[^/\s'"]+/g;
const MAX_LOGGED_ERROR_LENGTH = 500;

/** Never echo tokens, full URLs or secrets into logs. */
export function sanitizeTelegramError(message: string): string {
  let out = String(message || "");
  const configuredToken = readToken();
  if (configuredToken && configuredToken.trim().length >= 4) {
    out = out.split(configuredToken).join("[redacted]");
  }
  return out
    .replace(TOKEN_REDACT_RE, "bot[redacted]")
    .replace(URL_BOT_PATH_REDACT_RE, "/bot[redacted]")
    .slice(0, MAX_LOGGED_ERROR_LENGTH);
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
    if (
      ax.code &&
      ["ECONNABORTED", "ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN", "EPIPE"].includes(
        ax.code
      )
    ) {
      return true;
    }
    return true;
  }
  return false;
}

interface InternalSendMeta {
  dedupKey?: string;
  eventType?: "new_order" | "order_status" | "new_lead" | "new_contact" | "escalation";
  referenceId?: string;
}

async function sendMessage(text: string, meta?: InternalSendMeta): Promise<TelegramSendResult> {
  if (meta?.dedupKey && (await wasAlreadyDelivered(meta.dedupKey))) {
    return { delivered: false, skipped: true, duplicate: true };
  }

  if (!isConfigured()) {
    console.info("[telegram] notification skipped: not configured");
    const skippedRes: TelegramSendResult = { delivered: false, skipped: true };
    if (meta?.eventType && meta?.referenceId) {
      await persistNotificationLog({
        eventType: meta.eventType,
        referenceId: meta.referenceId,
        result: skippedRes,
        attempts: 0,
      });
    }
    return skippedRes;
  }

  const url = `${buildApiUrl()}/sendMessage`;
  const body = {
    chat_id: readChatId(),
    text: truncate(text),
    parse_mode: "Markdown",
    disable_web_page_preview: true,
  };

  let attempts = 0;
  try {
    await withRetry(
      () => {
        attempts += 1;
        return axios.post(url, body, {
          timeout: HTTP_TIMEOUT_MS,
          headers: { "Content-Type": "application/json" },
          maxContentLength: 16_000,
          maxBodyLength: 16_000,
        });
      },
      { ...RETRY, shouldRetry: isTransient }
    );
    const okRes: TelegramSendResult = { delivered: true };
    if (meta?.dedupKey) rememberDeliveredKey(meta.dedupKey);
    if (meta?.eventType && meta?.referenceId) {
      await persistNotificationLog({
        dedupKey: meta.dedupKey,
        eventType: meta.eventType,
        referenceId: meta.referenceId,
        result: okRes,
        attempts: Math.max(1, attempts),
      });
    }
    return okRes;
  } catch (err: any) {
    const status = err?.response?.status as number | undefined;
    const error = sanitizeTelegramError(err instanceof Error ? err.message : String(err));
    console.warn(`[telegram] sendMessage failed status=${status ?? "-"} error=${error}`);
    const failRes: TelegramSendResult = {
      delivered: false,
      error,
      ...(status !== undefined ? { status } : {}),
    };
    if (meta?.eventType && meta?.referenceId) {
      await persistNotificationLog({
        eventType: meta.eventType,
        referenceId: meta.referenceId,
        result: failRes,
        attempts: Math.max(1, attempts),
      });
    }
    return failRes;
  }
}

/** Stable, human-friendly date formatting for Telegram notifications. */
function formatTelegramDate(value: unknown): string {
  const raw = value || new Date();
  try {
    const d = new Date(raw as any);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  } catch {
    return "";
  }
}

/**
 * DXN Natural Life — Order notification (bilingual AR/FR/EN, legacy Markdown).
 * Only dynamic (user/database-controlled) values pass through escapeMarkdown;
 * static labels are literal formatting.
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
    "🛒 DXN Natural Life — *NEW ORDER*",
    "",
    `Order: ${esc(order.orderNumber)}`,
  ];

  const dateText = formatTelegramDate(order.createdAt);
  if (dateText) lines.push(`Timestamp: ${esc(dateText)}`);

  lines.push(
    "",
    "👤 *Customer / Client*",
    `Name: ${esc(customer.firstName)} ${esc(customer.lastName)}`,
    `Phone: ${esc(customer.phone)}`
  );
  if (customer.secondPhone) lines.push(`Second phone: ${esc(customer.secondPhone)}`);
  if (customer.wilaya) lines.push(`Wilaya: ${esc(customer.wilaya)}`);
  if (customer.commune) lines.push(`Commune: ${esc(customer.commune)}`);
  if (order.deliveryMethod === "home" && customer.address) {
    lines.push(`Address: ${esc(customer.address)}`);
  }
  if (order.dxnMemberId) {
    lines.push(`DXN Membership ID: ${esc(order.dxnMemberId)}`);
  }
  if (order.trafficSource?.source) {
    lines.push(`Referral Source: ${esc(order.trafficSource.source)}`);
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

/**
 * DXN Natural Life — New Membership Lead notification (Phase 8.2).
 */
export function buildMembershipLeadMessage(lead: any): string {
  const esc = escapeMarkdown;
  const lines = [
    "🤝 DXN Natural Life — *NEW MEMBERSHIP LEAD*",
    "",
    `Lead Reference: ${esc(lead.leadReference || "—")}`,
    `Timestamp: ${esc(formatTelegramDate(lead.createdAt))}`,
    "",
    "👤 *Applicant*",
    `Full Name: ${esc(lead.firstName)} ${esc(lead.lastName)}`,
    `Country: ${esc(lead.country)}`,
    `Phone: ${esc(lead.phone)}`,
    `Preferred Contact: ${esc(lead.preferredContactMethod)}`,
  ];

  if (lead.email) {
    lines.push(`Email: ${esc(lead.email)}`);
  }
  if (lead.existingMembershipNumber) {
    lines.push(`Existing DXN Membership: ${esc(lead.existingMembershipNumber)}`);
  }
  lines.push(
    `Sponsor Membership: ${esc(lead.sponsorMembershipNumber || "Not configured yet")}`,
    `Lead Source: ${esc(lead.trafficSource?.source || "direct")}`
  );

  if (lead.message) {
    lines.push("", "💬 *Message*", esc(lead.message));
  }

  return lines.join("\n");
}

/**
 * DXN Natural Life — New Contact Request notification (Phase 8.3).
 */
export function buildContactRequestMessage(contact: any): string {
  const esc = escapeMarkdown;
  const lines = [
    "✉️ DXN Natural Life — *NEW CONTACT REQUEST*",
    "",
    `Reference: ${esc(contact.reference || "—")}`,
    `Timestamp: ${esc(formatTelegramDate(contact.createdAt))}`,
    "",
    `Name: ${esc(contact.name)}`,
  ];
  if (contact.phone) lines.push(`Phone: ${esc(contact.phone)}`);
  if (contact.email) lines.push(`Email: ${esc(contact.email)}`);
  if (contact.subject) lines.push(`Subject: ${esc(contact.subject)}`);
  lines.push(`Source: ${esc(contact.trafficSource?.source || "direct")}`);
  lines.push("", "💬 *Message*", esc(contact.message || "—"));
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
  const ref = order?.orderNumber ? String(order.orderNumber) : undefined;
  return sendMessage(buildOrderMessage(order), {
    dedupKey: ref ? `new_order:${ref}` : undefined,
    eventType: "new_order",
    referenceId: ref || "unknown",
  });
}

export async function sendNewMembershipLeadNotification(lead: any): Promise<TelegramSendResult> {
  const ref = lead?.leadReference ? String(lead.leadReference) : undefined;
  return sendMessage(buildMembershipLeadMessage(lead), {
    dedupKey: ref ? `new_lead:${ref}` : undefined,
    eventType: "new_lead",
    referenceId: ref || "unknown",
  });
}

export async function sendNewContactRequestNotification(contact: any): Promise<TelegramSendResult> {
  const ref = contact?.reference ? String(contact.reference) : undefined;
  return sendMessage(buildContactRequestMessage(contact), {
    dedupKey: ref ? `new_contact:${ref}` : undefined,
    eventType: "new_contact",
    referenceId: ref || "unknown",
  });
}

export async function sendTelegramMessage(text: string): Promise<{ ok: boolean; delivered?: boolean; error?: string }> {
  const res = await sendMessage(text);
  return { ok: res.delivered, delivered: res.delivered, error: res.error };
}

export async function sendOrderStatusUpdate(order: any, statusText: string): Promise<TelegramSendResult> {
  const ref = order?.orderNumber ? String(order.orderNumber) : "unknown";
  return sendMessage(buildStatusMessage(order, statusText), {
    eventType: "order_status",
    referenceId: ref,
  });
}

export async function sendEscalationNotification(
  order: any,
  reason: string,
  customerInfo: any
): Promise<TelegramSendResult> {
  const ref = order?.orderNumber ? String(order.orderNumber) : "unknown";
  return sendMessage(buildEscalationMessage(order, reason, customerInfo), {
    eventType: "escalation",
    referenceId: ref,
  });
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
  sendNewMembershipLeadNotification,
  sendNewContactRequestNotification,
  sendOrderStatusUpdate,
  sendEscalationNotification,
  telegramSinkAdapter,
  isTelegramConfigured,
};
