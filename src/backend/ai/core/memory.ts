/**
 * Phase 19H — Conversation Memory
 *
 * Stores message history per conversation to allow natural multi-turn
 * conversation (e.g. "بشحال هذا؟" then "والتوصيل لسطيف؟" where "هذا" refers to
 * the previously discussed product).
 *
 * Do NOT send unlimited history to the LLM — enforce a context limit (default
 * last N messages). The store is abstracted behind an interface so it can be
 * backed by the mongoose Conversation/Message models in production and by an
 * in-memory map in tests.
 */
export interface MemoryMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
}

export interface ConversationStore {
  getHistory(conversationId: string): Promise<MemoryMessage[]>;
  append(conversationId: string, message: MemoryMessage): Promise<void>;
  clear(conversationId: string): Promise<void>;
}

export const DEFAULT_CONTEXT_LIMIT = 10;

/** Hard cap on stored messages per conversation to bound memory growth. */
export const MAX_STORED_MESSAGES = DEFAULT_CONTEXT_LIMIT * 4;

/**
 * Build an LLM context from conversation history, applying the context limit
 * and never exceeding it.
 */
export function buildContext(
  history: MemoryMessage[],
  contextLimit: number = DEFAULT_CONTEXT_LIMIT
): MemoryMessage[] {
  if (!history || history.length === 0) return [];
  return history.slice(-contextLimit);
}

/**
 * Summarize recent history to a compact string for Telegram escalation.
 */
export function summarizeForEscalation(
  history: MemoryMessage[],
  max = 400
): string {
  return history
    .slice(-8)
    .map((m) => `${m.role === "user" ? "C" : "A"}: ${m.content}`)
    .join("\n")
    .slice(-max);
}

/**
 * In-memory store, used in tests and as a lightweight default. NOT durable —
 * for production use the mongoose-backed store.
 */
export class InMemoryConversationStore implements ConversationStore {
  private db = new Map<string, MemoryMessage[]>();
  async getHistory(id: string): Promise<MemoryMessage[]> {
    this.db.set(id, this.db.get(id) || []);
    return this.db.get(id)!;
  }
  async append(id: string, message: MemoryMessage): Promise<void> {
    const h = this.db.get(id) || [];
    h.push({ ...message, timestamp: message.timestamp || Date.now() });
    this.db.set(id, h.slice(-MAX_STORED_MESSAGES));
  }
  async clear(id: string): Promise<void> {
    this.db.delete(id);
  }
}
