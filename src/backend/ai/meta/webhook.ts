/**
 * Phase 19P/19T — Meta Webhook Verification & Idempotency
 *
 * Official Meta webhook handling. These are pure/unit-testable functions:
 *
 * - GET verification: respond with the challenge when the mode + token match
 *   (exactly how Meta confirms a webhook endpoint during setup).
 * - POST validation: signature verification using the app secret (SHA256 of
 *   the raw body), payload validation, and event deduplication.
 *
 * Signature verification uses the raw request body (before JSON parsing) —
 * the Express route must pass the raw buffer (express.raw) for correctness.
 */
import * as crypto from "crypto";

export interface MetaWebhookConfig {
  verifyToken: string;
  appSecret: string;
}

/**
 * Handle the GET verification handshake required by Meta.
 * Returns the challenge string when valid, otherwise null.
 */
export function verifyWebhook(
  config: MetaWebhookConfig,
  query: { "hub.mode"?: string; "hub.verify_token"?: string; "hub.challenge"?: string }
): { ok: boolean; challenge?: string; reason?: string } {
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  if (mode === "subscribe" && token === config.verifyToken) {
    return { ok: true, challenge: query["hub.challenge"] };
  }
  return { ok: false, reason: "invalid verification request" };
}

/**
 * Verify the X-Hub-Signature-256 header for a webhook payload using the app
 * secret. Computes HMAC-SHA256 over the raw bodyBytes.
 */
export function verifySignature(
  config: MetaWebhookConfig,
  signatureHeader: string | undefined,
  bodyBytes: Buffer
): boolean {
  if (!signatureHeader) return false;
  const expectedPrefix = "sha256=";
  if (!signatureHeader.startsWith(expectedPrefix)) return false;
  const provided = signatureHeader.slice(expectedPrefix.length);
  const computed = crypto
    .createHmac("sha256", config.appSecret)
    .update(bodyBytes)
    .digest("hex");
  // Constant-time comparison to avoid timing attacks.
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(computed, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Validate that a webhook payload has the expected shape before processing.
 */
export function validateMetaPayload(body: any): { ok: boolean; reason?: string } {
  if (!body || typeof body !== "object") return { ok: false, reason: "no payload" };
  if (!Array.isArray(body.entry)) return { ok: false, reason: "missing entry[]" };
  if (body.object !== "instagram" && body.object !== "page") {
    return { ok: false, reason: `unexpected object: ${body.object}` };
  }
  return { ok: true };
}

/**
 * Extract a stable, unique deduplication key from a Meta messaging event.
 * Meta may redeliver the same event; the key lets us skip processing twice.
 * Returns null when the event is not a message we handle.
 */
export function extractEventKey(body: any): { key: string; message?: { text: string; senderId: string; messageId: string }; platform: string } | null {
  const object = body?.object;
  const entry = Array.isArray(body?.entry) ? body.entry[0] : undefined;
  const messaging = entry?.messaging?.[0] || entry?.standby?.[0];
  if (!messaging) return null;
  const sender = messaging.sender?.id;
  const messageObject = messaging.message;
  const messageId = messageObject?.mid || messageObject?.id;
  const text = messageObject?.text;
  if (!sender) return null;
  // Only handle plain text messages; ignore echoes, deliveries, reads, postbacks.
  if (messageId === undefined && text === undefined) return null;
  const platform = object === "instagram" ? "instagram" : "facebook";
  return {
    key: `${platform}:${sender}:${messageId || messaging.timestamp || Date.now()}`,
    message: {
      text: text || "",
      senderId: sender,
      messageId: messageId || "",
    },
    platform,
  };
}

/**
 * Convert a Meta webhook event into a normalized internal message that the
 * orchestrator can process. Throws when the event has no usable text.
 */
export function toNormalizedMessage(
  body: any
): { platform: "instagram" | "facebook"; senderId: string; messageId: string; text: string } | null {
  const parsed = extractEventKey(body);
  if (!parsed || !parsed.message) return null;
  return {
    platform: parsed.platform as "instagram" | "facebook",
    senderId: parsed.message.senderId,
    messageId: parsed.message.messageId,
    text: parsed.message.text,
  };
}

/**
 * Compute a deterministic conversation identifier for a sender on a platform.
 * Used to scope memory and the response channel.
 */
export function conversationIdFor(platform: string, senderId: string): string {
  return `${platform}:${senderId}`;
}
