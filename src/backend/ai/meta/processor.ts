/**
 * Phase 19N/19O — Social Processor (Instagram / Facebook)
 *
 * Connects a validated Meta webhook event to the AI orchestrator and sends the
 * reply back through the Meta Messaging API. Applies idempotency (Phase 19T):
 * a processed event key is remembered so a redelivered webhook is NOT answered
 * twice.
 *
 * Dependencies injected to keep this unit-testable without a DB or network:
 *  - store: ConversationStore (memory)
 *  - dedup: processed-event registry (add/has)
 *  - messenger: MetaMessenger (transport injected)
 */
import { Orchestrator } from "../core/orchestrator";
import { MetaMessenger } from "../meta/messenger";
import { toNormalizedMessage, conversationIdFor } from "../meta/webhook";
import { notifyHumanHandoff, TelegramSink } from "../core/escalation";

export interface DedupRegistry {
  has(key: string): boolean | Promise<boolean>;
  /**
   * Atomically claim the key. Returns true when THIS call won the claim (i.e.
   * the event was not already processed), false when it was already claimed.
   * Implementations must be safe under concurrency/restart (durable registry).
   */
  add(key: string): boolean | Promise<boolean>;
}

export class InMemoryDedupRegistry implements DedupRegistry {
  private set = new Set<string>();
  has(key: string): boolean {
    return this.set.has(key);
  }
  add(key: string): boolean {
    if (this.set.has(key)) return false;
    this.set.add(key);
    return true;
  }
}

export interface SocialProcessorOptions {
  orchestrator: Orchestrator;
  messenger: MetaMessenger;
  dedup?: DedupRegistry;
  /**
   * Optional Telegram sink used to notify the human owner when the AI decides
   * a conversation needs human handoff. When absent, the handoff is recorded
   * (no automated reply is sent) but no external notification is dispatched.
   */
  telegramSink?: TelegramSink;
}

export interface AppEventResult {
  handled: boolean;
  duplicate: boolean;
  replySent: boolean;
  /** True when the AI required human handoff AND we dispatched the Telegram notice. */
  humanEscalated?: boolean;
  platform?: "instagram" | "facebook";
  text?: string;
}

/**
 * Process a raw Meta webhook body (already signature-validated upstream).
 * Returns duplicate=true and sends nothing when the event key was already
 * processed (Phase 19T — Meta retries must not cause duplicate replies).
 */
export async function processWebhookEvent(
  body: unknown,
  opts: SocialProcessorOptions
): Promise<AppEventResult> {
  console.log("[DIAGNOSTIC-PROCESSOR] processWebhookEvent_start", JSON.stringify({
    bodyKeys: Object.keys(body as object),
    objectType: (body as any)?.object,
    hasEntry: Array.isArray((body as any)?.entry),
    entryCount: Array.isArray((body as any)?.entry) ? (body as any).entry.length : 0,
    firstEntryKeys: Array.isArray((body as any)?.entry) && (body as any).entry.length > 0 ? Object.keys((body as any).entry[0]) : [],
    messagingCount: Array.isArray((body as any)?.entry) && (body as any).entry.length > 0 ? ((body as any).entry[0]?.messaging?.length || 0) : 0,
    firstMessagingKeys: Array.isArray((body as any)?.entry) && (body as any).entry.length > 0 && Array.isArray((body as any).entry[0]?.messaging) && (body as any).entry[0].messaging.length > 0 ? Object.keys((body as any).entry[0].messaging[0]) : [],
    changesCount: Array.isArray((body as any)?.entry) && (body as any).entry.length > 0 ? ((body as any).entry[0]?.changes?.length || 0) : 0,
    firstChangeKeys: Array.isArray((body as any)?.entry) && (body as any).entry.length > 0 && Array.isArray((body as any).entry[0]?.changes) && (body as any).entry[0].changes.length > 0 ? Object.keys((body as any).entry[0].changes[0]) : [],
    firstChangeField: Array.isArray((body as any)?.entry) && (body as any).entry.length > 0 && Array.isArray((body as any).entry[0]?.changes) && (body as any).entry[0].changes.length > 0 ? (body as any).entry[0].changes[0]?.field : null,
    hasMessageObject: Array.isArray((body as any)?.entry) && (body as any).entry.length > 0 && Array.isArray((body as any).entry[0]?.messaging) && (body as any).entry[0].messaging.length > 0 && !!(body as any).entry[0].messaging[0]?.message,
    hasMessageText: Array.isArray((body as any)?.entry) && (body as any).entry.length > 0 && Array.isArray((body as any).entry[0]?.messaging) && (body as any).entry[0].messaging.length > 0 && !!(body as any).entry[0].messaging[0]?.message?.text,
    hasSenderObject: Array.isArray((body as any)?.entry) && (body as any).entry.length > 0 && Array.isArray((body as any).entry[0]?.messaging) && (body as any).entry[0].messaging.length > 0 && !!(body as any).entry[0].messaging[0]?.sender,
    hasRecipientObject: Array.isArray((body as any)?.entry) && (body as any).entry.length > 0 && Array.isArray((body as any).entry[0]?.messaging) && (body as any).entry[0].messaging.length > 0 && !!(body as any).entry[0].messaging[0]?.recipient,
    hasTimestamp: Array.isArray((body as any)?.entry) && (body as any).entry.length > 0 && Array.isArray((body as any).entry[0]?.messaging) && (body as any).entry[0].messaging.length > 0 && !!(body as any).entry[0].messaging[0]?.timestamp,
  }));

  const normalized = toNormalizedMessage(body as any);
  console.log("[DIAGNOSTIC-PROCESSOR] normalized_message", JSON.stringify({
    hasNormalized: !!normalized,
    platform: normalized?.platform,
    senderId: normalized?.senderId,
    messageId: normalized?.messageId,
    textLength: normalized?.text?.length || 0,
    textPreview: normalized?.text?.slice(0, 50),
  }));

  if (!normalized) {
    console.log("[DIAGNOSTIC-PROCESSOR] no_normalized_message_returning");
    return { handled: false, duplicate: false, replySent: false };
  }

  const dedup = opts.dedup || new InMemoryDedupRegistry();
  const convId = conversationIdFor(normalized.platform, normalized.senderId);
  const key = `${normalized.platform}:${normalized.senderId}:${normalized.messageId}`;

  console.log("[DIAGNOSTIC-PROCESSOR] dedup_key_generated", JSON.stringify({
    platform: normalized.platform,
    senderIdLength: normalized.senderId?.length || 0,
    senderIdPrefix: normalized.senderId?.slice(0, 10),
    messageId: normalized.messageId,
    messageIdLength: normalized.messageId?.length || 0,
    keyLength: key.length,
    keyPrefix: key.split(":")[0],
  }));

  // Atomically claim the event key. If another worker/restart already processed
  // this event (or Meta redelivered it), the claim returns false and we must
  // NOT answer again (durable idempotency, at-most-once).
  const claimed = await dedup.add(key);
  console.log("[DIAGNOSTIC-PROCESSOR] dedup_check", JSON.stringify({
    key,
    claimed,
  }));
  if (!claimed) {
    console.log("[DIAGNOSTIC-PROCESSOR] duplicate_detected_returning");
    return { handled: true, duplicate: true, replySent: false, platform: normalized.platform };
  }

  console.log("[DIAGNOSTIC-PROCESSOR] calling_orchestrator_handleMessage");
  const result = await opts.orchestrator.handleMessage(
    convId,
    normalized.text,
    undefined
  );

  console.log("[DIAGNOSTIC-PROCESSOR] orchestrator_result", JSON.stringify({
    hasResponse: !!result.response,
    responseLength: result.response?.length || 0,
    responsePreview: result.response?.slice(0, 50),
    needsHumanHandoff: result.needsHumanHandoff,
    intent: result.intent,
    language: result.language,
    confidence: result.confidence,
    performedRetrieval: result.performedRetrieval,
    validation: result.validation,
  }));

  let replySent = false;
  let humanEscalated = false;
  if (result.needsHumanHandoff) {
    console.log("[DIAGNOSTIC-PROCESSOR] human_handoff_required");
    // Human handoff: never auto-reply (correctness). Notify the owner through
    // the existing escalation pipeline when a Telegram sink is wired in.
    if (opts.telegramSink) {
      const esc = await notifyHumanHandoff(opts.telegramSink, {
        platform: normalized.platform,
        conversationId: convId,
        customerIdentifier: normalized.senderId,
        reason: result.intent || "needs human assistance",
        recentContext: `${normalized.platform}: ${normalized.text}`.slice(0, 400),
      });
      humanEscalated = esc.delivered;
      console.log("[DIAGNOSTIC-PROCESSOR] telegram_notification_sent", JSON.stringify({
        delivered: esc.delivered,
      }));
    }
  } else {
    try {
      console.log("[DIAGNOSTIC-PROCESSOR] calling_messenger_sendText");
      const out = await opts.messenger.sendText(normalized.platform, normalized.senderId, result.response);
      console.log("[DIAGNOSTIC-PROCESSOR] messenger_sendText_result", JSON.stringify({
        recipientId: out?.recipientId,
        messageId: out?.messageId,
        replySent: !!out,
      }));
      replySent = !!out;
    } catch (err) {
      // Sending is best-effort; the orchestrator already decided not to escalate.
      console.error("[DIAGNOSTIC-PROCESSOR] messenger_sendText_error", err instanceof Error ? err.message : String(err));
      replySent = false;
    }
  }

  console.log("[DIAGNOSTIC-PROCESSOR] processWebhookEvent_complete", JSON.stringify({
    handled: true,
    duplicate: false,
    replySent,
    humanEscalated,
    platform: normalized.platform,
    textLength: result.response?.length || 0,
  }));

  return {
    handled: true,
    duplicate: false,
    replySent,
    humanEscalated,
    platform: normalized.platform,
    text: result.response,
  };
}
