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
import { getAiSalesMode, AiSalesMode } from "../../config/env";
import { aiDebug } from "../debug";

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
   * AI sales mode override. When absent, the current runtime value of
   * process.env.AI_SALES_MODE is read dynamically (default PAUSED). Supplying
   * the override makes tests deterministic without mutating process.env.
   */
  aiSalesMode?: AiSalesMode;
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
  const msg: any = (body as any)?.entry?.[0]?.messaging?.[0];
  const chg: any = (body as any)?.entry?.[0]?.changes?.[0];
  aiDebug("processor.webhook_received", {
    objectType: (body as any)?.object,
    entryCount: Array.isArray((body as any)?.entry) ? (body as any).entry.length : 0,
    firstEntryKeys: Array.isArray((body as any)?.entry) && (body as any).entry.length > 0 ? Object.keys((body as any).entry[0]) : [],
    messagingCount: Array.isArray((body as any)?.entry) && (body as any).entry.length > 0 ? ((body as any).entry[0]?.messaging?.length || 0) : 0,
    firstMessagingKeys: msg ? Object.keys(msg) : [],
    changesCount: Array.isArray((body as any)?.entry) && (body as any).entry.length > 0 ? ((body as any).entry[0]?.changes?.length || 0) : 0,
    firstChangeKeys: chg ? Object.keys(chg) : [],
    firstChangeField: chg?.field ?? null,
    hasMessageObject: !!msg?.message,
  });

  const normalized = toNormalizedMessage(body as any);
  aiDebug("processor.normalized", {
    hasNormalized: !!normalized,
    platform: normalized?.platform,
    textLength: normalized?.text?.length || 0,
  });

  if (!normalized) {
    aiDebug("processor.no_normalized_message_returning");
    return { handled: false, duplicate: false, replySent: false };
  }

  const dedup = opts.dedup || new InMemoryDedupRegistry();
  const convId = conversationIdFor(normalized.platform, normalized.senderId);
  const key = `${normalized.platform}:${normalized.senderId}:${normalized.messageId}`;

  // Atomically claim the event key. If another worker/restart already processed
  // this event (or Meta redelivered it), the claim returns false and we must
  // NOT answer again (durable idempotency, at-most-once).
  let claimed: boolean;
  try {
    claimed = await dedup.add(key);
  } catch (err) {
    console.error("[AI] dedup claim failed (webhook will retry):", err instanceof Error ? err.message : String(err));
    // Re-throw to let the webhook return 500 so Meta can retry
    throw err;
  }
  aiDebug("processor.dedup_checked", { key, claimed });
  if (!claimed) {
    aiDebug("processor.duplicate_detected_returning");
    return { handled: true, duplicate: true, replySent: false, platform: normalized.platform };
  }

  aiDebug("processor.calling_orchestrator");
  const result = await opts.orchestrator.handleMessage(
    convId,
    normalized.text,
    undefined
  );

  aiDebug("processor.orchestrator_result", {
    hasResponse: !!result.response,
    responseLength: result.response?.length || 0,
    needsHumanHandoff: result.needsHumanHandoff,
    intent: result.intent,
    language: result.language,
    confidence: result.confidence,
    performedRetrieval: result.performedRetrieval,
    validation: result.validation,
  });

  const aiSalesMode = opts.aiSalesMode ?? getAiSalesMode();

  // AI Sales Mode Pause Check - if paused, do not send AI response to customer
  // but still process human handoffs if needed
  if (aiSalesMode === "PAUSED") {
    aiDebug("processor.paused_suppressing_outbound", {
      needsHumanHandoff: result.needsHumanHandoff,
      intent: result.intent,
    });

    // Still process human handoff if needed, but don't send AI response to customer
    let humanEscalated = false;
    if (result.needsHumanHandoff) {
      aiDebug("processor.human_handoff_required_paused");
      if (opts.telegramSink) {
        const esc = await notifyHumanHandoff(opts.telegramSink, {
          platform: normalized.platform,
          conversationId: convId,
          customerIdentifier: normalized.senderId,
          reason: result.intent || "needs human assistance",
          recentContext: `${normalized.platform}: ${normalized.text}`.slice(0, 400),
        });
        humanEscalated = esc.delivered;
      }
    }

    return {
      handled: true,
      duplicate: false,
      replySent: false,
      humanEscalated,
      platform: normalized.platform,
      text: "", // No response sent to customer
    };
  }

  let replySent = false;
  let humanEscalated = false;
  if (result.needsHumanHandoff) {
    aiDebug("processor.human_handoff_required");
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
    }
  } else {
    try {
      const out = await opts.messenger.sendText(normalized.platform, normalized.senderId, result.response);
      aiDebug("processor.messenger_sendText_result", {
        messageId: out?.messageId,
        replySent: !!out,
      });
      replySent = !!out;
    } catch (err) {
      // Sending is best-effort; the orchestrator already decided not to escalate.
      console.error("[AI] messenger send failed (best-effort):", err instanceof Error ? err.message : String(err));
      replySent = false;
    }
  }

  aiDebug("processor.webhook_complete", {
    handled: true,
    duplicate: false,
    replySent,
    humanEscalated,
    platform: normalized.platform,
    textLength: result.response?.length || 0,
  });

  return {
    handled: true,
    duplicate: false,
    replySent,
    humanEscalated,
    platform: normalized.platform,
    text: result.response,
  };
}
