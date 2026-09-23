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

// Import models statically so Vercel's bundler can trace the dependency.
// Only import what MongooseConversationStore actually uses: Conversation and Message.
import { Conversation, Message } from "../../../Database/Models";

/**
 * Mongoose-backed conversation store for production.
 * Uses the existing Conversation/Message models for durable persistence.
 */
export class MongooseConversationStore implements ConversationStore {
  async getHistory(conversationId: string): Promise<MemoryMessage[]> {
    const conv = await Conversation.findOne({ platformId: conversationId, isActive: true }).lean();
    if (!conv) return [];
    
    const messages = await Message.find({ conversationId: conv._id })
      .sort({ createdAt: 1 })
      .limit(DEFAULT_CONTEXT_LIMIT * 4)
      .lean();
    
    return (messages as any[]).map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.createdAt?.getTime(),
    }));
  }

  async append(conversationId: string, message: MemoryMessage): Promise<void> {
    // Find or create conversation
    let conv = await Conversation.findOne({ platformId: conversationId, isActive: true });
    if (!conv) {
      const [platform, platformId] = conversationId.split(":");
      conv = await Conversation.create({
        platform: platform as "instagram" | "facebook",
        platformId,
        isActive: true,
        lastMessage: message.content.slice(0, 200),
        lastActivity: new Date(),
      });
    }
    
    // Update conversation metadata
    conv.lastMessage = message.content.slice(0, 200);
    conv.lastActivity = new Date();
    await conv.save();
    
    // Append message
    await Message.create({
      conversationId: conv._id,
      role: message.role,
      content: message.content,
    });

    // Bound storage: keep at most MAX_STORED_MESSAGES per conversation so a
    // long-running or abusive thread cannot grow the collection without limit.
    await this.pruneConversation(conv._id);
  }

  /**
   * Best-effort pruning of the oldest messages beyond MAX_STORED_MESSAGES.
   * Never throws: the append path must not fail because pruning did.
   */
  private async pruneConversation(conversationId: unknown): Promise<void> {
    try {
      const count = await Message.countDocuments({ conversationId });
      if (count <= MAX_STORED_MESSAGES) return;
      const boundary = await Message.findOne({ conversationId })
        .sort({ createdAt: -1 })
        .skip(MAX_STORED_MESSAGES)
        .select({ _id: 1, createdAt: 1 })
        .lean();
      if (!boundary?.createdAt) return;
      await Message.deleteMany({
        conversationId,
        createdAt: { $lt: boundary.createdAt },
      });
    } catch (err) {
      console.error("[AI-MEMORY] conversation prune skipped (best-effort):", err instanceof Error ? err.message : String(err));
    }
  }

  async clear(conversationId: string): Promise<void> {
    const conv = await Conversation.findOne({ platformId: conversationId });
    if (conv) {
      await Message.deleteMany({ conversationId: conv._id });
      await Conversation.deleteOne({ _id: conv._id });
    }
  }
}
