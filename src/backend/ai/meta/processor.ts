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
  const normalized = toNormalizedMessage(body as any);
  if (!normalized) {
    return { handled: false, duplicate: false, replySent: false };
  }

  const dedup = opts.dedup || new InMemoryDedupRegistry();
  const convId = conversationIdFor(normalized.platform, normalized.senderId);
  const key = `${normalized.platform}:${normalized.senderId}:${normalized.messageId}`;

  // Atomically claim the event key. If another worker/restart already processed
  // this event (or Meta redelivered it), the claim returns false and we must
  // NOT answer again (durable idempotency, at-most-once).
  const claimed = await dedup.add(key);
  if (!claimed) {
    return { handled: true, duplicate: true, replySent: false, platform: normalized.platform };
  }

  const result = await opts.orchestrator.handleMessage(
    convId,
    normalized.text,
    undefined
  );

  let replySent = false;
  let humanEscalated = false;
  if (result.needsHumanHandoff) {
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
      replySent = !!out;
    } catch {
      // Sending is best-effort; the orchestrator already decided not to escalate.
      replySent = false;
    }
  }

  return {
    handled: true,
    duplicate: false,
    replySent,
    humanEscalated,
    platform: normalized.platform,
    text: result.response,
  };
}
