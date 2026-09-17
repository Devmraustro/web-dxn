/**
 * Phase 19P — Meta Webhook Routes
 *
 * GET  /meta/webhook  — verification handshake (challenge response)
 * POST /meta/webhook  — event delivery, signature-validated and idempotent
 *
 * The POST route parses the RAW body for correct HMAC signature verification
 * (Meta signs the raw payload). Only after signature verification is the event
 * parsed and forwarded to the social processor.
 *
 * Security (Phase 19AJ): webhook payloads are treated as untrusted. No secret
 * is ever logged or sent back.
 */
import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import * as crypto from "crypto";
import {
  verifyWebhook,
  verifySignature,
} from "../ai/meta/webhook";
import { processWebhookEvent } from "../ai/meta/processor";
import { Orchestrator } from "../ai/core/orchestrator";
import { createProvider } from "../ai/provider/AIProvider";
import { MetaMessenger } from "../ai/meta/messenger";
import { MongoDedupRegistry } from "../ai/meta/mongoDedup";
import { TelegramSink } from "../ai/core/escalation";
import { getMetaConfig, isMetaConfigured, getMetaHealth } from "../ai/meta/config";
import { MongooseDataAccess } from "../ai/dataAccess";
import axios from "axios";

const router = Router();
const verifyToken = process.env.META_VERIFY_TOKEN || "";
const appSecret = process.env.META_APP_SECRET || "";
const pageToken = process.env.META_PAGE_ACCESS_TOKEN || "";
const graphVersion = process.env.META_GRAPH_VERSION || "v26.0";

/**
 * Safe diagnostic logging for Meta webhook verification.
 * NEVER logs actual token values. Only logs safe metadata.
 */
function logWebhookDiagnostic(
  label: string,
  data: Record<string, unknown>
): void {
  // In production, we use console.log which Vercel captures in function logs
  // The data object contains NO secrets, only safe metadata
  console.log(`[META-WEBHOOK-DIAGNOSTIC] ${label}`, JSON.stringify(data));
}

/**
 * Compute SHA-256 fingerprint of a string for safe comparison logging.
 * Returns first 16 chars of hex digest - sufficient for equality check without exposing full value.
 */
function fingerprint(str: string): string {
  return crypto.createHash("sha256").update(str).digest("hex").slice(0, 16);
}

// Endpoint-specific rate limiting (Phase 19V): Meta webhooks and AI endpoints
// get their own stricter limits so a flood or misconfigured caller cannot
// exhaust the global budget or hammer the AI/outsourced APIs.
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "rate_limited" },
});

// Durable idempotency registry: backed by the WebhookEvent Mongo collection
// (unique index on dedupKey) so Meta redeliveries are recognized across
// restarts and replicas. Built lazily on first use so unit tests that never
// touch the route don't require Mongo.
let dedup: MongoDedupRegistry | null = null;
function getDedup(): MongoDedupRegistry {
  if (!dedup) dedup = new MongoDedupRegistry({ source: "meta" });
  return dedup;
}

// Telegram sink for AI human-handoff notifications, reusing the same env vars
// as the order/status notifications (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).
let telegramSink: TelegramSink | null = null;
function getTelegramSink(): TelegramSink | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return null;
  if (!telegramSink) {
    telegramSink = {
      send: async (message: string): Promise<unknown> => {
        const res = await axios.post(
          `https://api.telegram.org/bot${token}/sendMessage`,
          { chat_id: chatId, text: message, parse_mode: "Markdown" },
          { timeout: 15000 }
        );
        return res.data;
      },
    };
  }
  return telegramSink;
}

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

let messenger: MetaMessenger | null = null;
function getMessenger(): MetaMessenger {
  if (!messenger) {
    messenger = new MetaMessenger({ pageAccessToken: pageToken, graphVersion });
  }
  return messenger;
}

/**
 * GET verification handshake.
 */
router.get("/webhook", (req: Request, res: Response) => {
  // SAFE DIAGNOSTIC: Log raw request at Express route entry
  const rawUrl = req?.url || "";
  const rawOriginalUrl = req?.originalUrl || "";
  const queryObj = req?.query || {};
  const queryKeys = Object.keys(queryObj);

  console.log("[META-ROUTE-DIAGNOSTIC] route_entry", JSON.stringify({
    urlPath: rawUrl.split("?")[0],
    originalUrlPath: rawOriginalUrl.split("?")[0],
    urlHasQuery: rawUrl.includes("?"),
    originalUrlHasQuery: rawOriginalUrl.includes("?"),
    queryKeys,
    queryHubMode: queryObj["hub.mode"],
    queryHubVerifyTokenPresent: !!queryObj["hub.verify_token"],
    queryHubChallengePresent: !!queryObj["hub.challenge"],
    method: req.method,
  }));

  const query = req.query as Record<string, string | undefined>;
  const config = { verifyToken, appSecret };
  
  // Extract query parameters as Meta sends them (with dots in names)
  const receivedMode = query["hub.mode"];
  const receivedVerifyToken = query["hub.verify_token"];
  const receivedChallenge = query["hub.challenge"];
  
  // SAFE DIAGNOSTIC LOGGING - NO SECRETS EXPOSED
  const receivedTokenLength = typeof receivedVerifyToken === "string" ? receivedVerifyToken.length : 0;
  const configuredTokenLength = typeof verifyToken === "string" ? verifyToken.length : 0;
  const receivedFingerprint = typeof receivedVerifyToken === "string" ? fingerprint(receivedVerifyToken) : "N/A";
  const configuredFingerprint = typeof verifyToken === "string" ? fingerprint(verifyToken) : "N/A";
  const fingerprintsMatch = receivedFingerprint === configuredFingerprint && receivedFingerprint !== "N/A";
  
  const hasLeadingWhitespace = typeof receivedVerifyToken === "string" && receivedVerifyToken.startsWith(" ");
  const hasTrailingWhitespace = typeof receivedVerifyToken === "string" && receivedVerifyToken.endsWith(" ");
  const hasInternalWhitespace = typeof receivedVerifyToken === "string" && /\s/.test(receivedVerifyToken.slice(1, -1));
  
  logWebhookDiagnostic("verification_request_received", {
    requestReachedWebhook: true,
    httpMethod: req.method,
    pathname: req.path,
    hubModePresent: receivedMode !== undefined,
    hubModeValue: receivedMode,
    hubVerifyTokenPresent: receivedVerifyToken !== undefined,
    receivedVerifyTokenLength: receivedTokenLength,
    configuredVerifyTokenLength: configuredTokenLength,
    receivedVerifyTokenFingerprint: receivedFingerprint,
    configuredVerifyTokenFingerprint: configuredFingerprint,
    fingerprintsMatch: fingerprintsMatch,
    hasLeadingWhitespace: hasLeadingWhitespace,
    hasTrailingWhitespace: hasTrailingWhitespace,
    hasInternalWhitespace: hasInternalWhitespace,
    hubChallengePresent: receivedChallenge !== undefined,
    challengeLength: typeof receivedChallenge === "string" ? receivedChallenge.length : 0,
  });

  const result = verifyWebhook(config, {
    "hub.mode": receivedMode,
    "hub.verify_token": receivedVerifyToken,
    "hub.challenge": receivedChallenge,
  });

  logWebhookDiagnostic("verification_result", {
    verificationOk: result.ok,
    reason: result.reason,
    challengePresent: !!result.challenge,
    challengeLength: typeof result.challenge === "string" ? result.challenge.length : 0,
  });

  if (result.ok && result.challenge) {
    logWebhookDiagnostic("verification_success", {
      finalHttpStatus: 200,
      responseBodyIsChallenge: true,
      responseBodyLength: result.challenge.length,
    });
    return res.status(200).send(result.challenge);
  }
  
  logWebhookDiagnostic("verification_failed", {
    finalHttpStatus: 403,
    responseBody: "Verification failed",
  });
  return res.status(403).send("Verification failed");
});

/**
 * POST event delivery.
 */
router.post("/webhook", webhookLimiter, async (req: Request, res: Response) => {
  // express.raw() (mounted on /meta in app.ts) sets req.body to a Buffer of the
  // exact bytes Meta transmitted, so we can verify the signature over them.
  const rawBody = req.body;

  const signature = req.header("x-hub-signature-256");
  if (!verifySignature({ verifyToken, appSecret }, signature, rawBody)) {
    // Never reveal whether the secret or signature had a problem.
    return res.status(401).json({ status: "invalid signature" });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ status: "invalid json" });
  }

  const cfg = getMetaConfig();

  // If Meta integration is not configured externally (EXTERNAL CONFIGURATION
  // REQUIRED), acknowledge the event loudly but do not attempt to connect.
  if (!isMetaConfigured(cfg)) {
    return res.status(200).json({ status: "not_configured" });
  }

  // Wrap in try/catch so we ALWAYS acknowledge Meta quickly (HTTP 200) even
  // when processing throws. Without this, an unhandled rejection would produce
  // a 500 and Meta would retry indefinitely, causing a storm of duplicate events.
  try {
    await processWebhookEvent(body, {
      orchestrator: getOrchestrator(),
      messenger: getMessenger(),
      dedup: getDedup(),
      telegramSink: getTelegramSink() || undefined,
    });
  } catch (err) {
    // Log without propagating so Meta gets a clean 200 ack
    console.error("processWebhookEvent threw:", err instanceof Error ? err.message : String(err));
  }

  return res.status(200).json({ status: "received" });
});

/**
 * GET /meta/health — reports Meta integration state WITHOUT leaking secrets.
 * Differentiates NOT_CONFIGURED / CONFIGURED_NOT_LIVE_VERIFIED / LIVE_VERIFIED
 * / ERROR so the owner can tell, at a glance, what external setup is still
 * required (Phase 23).
 */
router.get("/health", (_req: Request, res: Response) => {
  const health = getMetaHealth();
  res.json({
    integration: "meta",
    status: health.status,
    platforms: health.platforms,
    graphVersion,
    details: health.details,
  });
});

export default router;
