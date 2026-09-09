/**
 * Phase 19M/19W — Telegram AI Escalation
 *
 * When the AI escalates a conversation, notify the owner through Telegram with
 * platform, conversation ID, customer identifier (minimized), reason and a
 * trimmed recent-conversation excerpt. Follows Phase 19AG (privacy
 * minimization): only data required for the business is sent.
 */
import { withRetry } from "./retry";

export interface EscalationPayload {
  platform: "instagram" | "facebook" | "web";
  conversationId: string;
  customerIdentifier?: string;
  reason: string;
  recentContext?: string;
}

export interface TelegramSink {
  send(message: string): Promise<unknown>;
}

/**
 * Build the escalation message text.
 */
export function buildEscalationMessage(p: EscalationPayload): string {
  const lines = [
    "⚠️ *AI HUMAN HANDOFF*",
    "",
    `Platform: ${p.platform}`,
    `Conversation: ${p.conversationId}`,
  ];
  if (p.customerIdentifier) {
    lines.push(`Customer: ${maskIdentifier(p.customerIdentifier)}`);
  }
  lines.push(`Reason: ${p.reason}`);
  if (p.recentContext) {
    lines.push("", "Recent conversation:", p.recentContext);
  }
  return lines.join("\n");
}

/**
 * Follow privacy minimization: never send the full customer PSID/phone
 * unredacted through a notification channel.
 */
function maskIdentifier(id: string): string {
  if (!id) return id;
  if (id.length <= 4) return "*".repeat(id.length);
  return `${id.slice(0, 2)}***${id.slice(-2)}`;
}

/**
 * Notify the owner, with retries, without ever throwing (escalation is
 * best-effort and must not break the integration).
 */
export async function notifyHumanHandoff(
  sink: TelegramSink,
  payload: EscalationPayload
): Promise<{ delivered: boolean; error?: string }> {
  try {
    const message = buildEscalationMessage(payload);
    await withRetry(() => sink.send(message), { maxAttempts: 3, baseDelayMs: 200 });
    return { delivered: true };
  } catch (err) {
    return { delivered: false, error: err instanceof Error ? err.message : String(err) };
  }
}
