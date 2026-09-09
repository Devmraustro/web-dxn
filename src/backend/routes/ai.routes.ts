/**
 * Express router exposing the AI chat and health endpoints.
 * Body is parsed as raw text so the (untrusted) customer input is passed to
 * the orchestrator which applies input guardrails before anything is used.
 */
import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { Orchestrator } from "../ai/core/orchestrator";
import { createProvider } from "../ai/provider/AIProvider";
import { MongooseDataAccess } from "../ai/dataAccess";

const MAX_MESSAGE_LENGTH = 2000;

// AI endpoints are expensive (retrieval + optional LLM) and can be abused as a
// free text oracle, so they get their own stricter per-IP budget. In-memory on
// each instance; on Vercel each function instance enforces its own budget,
// which is defense-in-depth on top of the model-level input guardrails.
const aiMessageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited" },
});

// Built on first use; requires Mongo at runtime (see note in dataAccess.ts).
let orchestrator: Orchestrator | null = null;
function getOrchestrator(): Orchestrator {
  if (!orchestrator) {
    orchestrator = new Orchestrator({
      dataAccess: new MongooseDataAccess(),
      provider: createProvider(),
    });
  }
  return orchestrator;
}

const router = Router();

/**
 * POST /api/ai/message
 * Customer-facing AI message endpoint (e.g. a chat widget). The conversation is
 * keyed by an opaque client-provided conversation id to scope memory.
 */
router.post("/message", aiMessageLimiter, async (req: Request, res: Response) => {
  try {
    const { message, conversationId } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message is required" });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: "message is too long" });
    }
    const id =
      typeof conversationId === "string" && conversationId && conversationId.length <= 200
        ? conversationId
        : "web:anon";
    const result = await getOrchestrator().handleMessage(id, message);
    res.json({
      response: result.response,
      needsHumanHandoff: result.needsHumanHandoff,
      intent: result.intent,
      language: result.language,
    });
  } catch (error) {
    res.status(500).json({ error: "AI request failed" });
  }
});

/**
 * GET /api/ai/health
 * Reports whether the configured AI provider is healthy WITHOUT leaking any
 * key material. When no external provider is configured, reports the
 * deterministic fallback as healthy.
 */
router.get("/health", async (_req: Request, res: Response) => {
  try {
    const provider = createProvider();
    const healthy = await provider.healthCheck();
    res.json({
      provider: provider.name,
      healthy,
      configError: provider.configError || undefined,
    });
  } catch {
    res.status(500).json({ provider: "unknown", healthy: false });
  }
});

export default router;
