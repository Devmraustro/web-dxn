/**
 * Phase 19N/19O — Meta Messaging Client (Instagram + Facebook)
 *
 * Officially send messages back to customers through Meta's Graph API using
 * the page access token. No scraping, no browser automation, no unofficial
 * APIs.
 *
 * For unit tests, inject a transport function; in production the default
 * transport calls the Graph API over HTTPS.
 */
import axios from "axios";
import { withRetry, RetryOptions } from "../core/retry";
import { aiDebug } from "../debug";

export type MetaPlatform = "instagram" | "facebook";

export interface MetaMessengerOptions {
  pageAccessToken: string;
  /** Conversation API ID, may differ per platform / page. */
  graphVersion?: string;
  transport?: (url: string, body: unknown, headers: Record<string, string>) => Promise<unknown>;
}

/**
 * Classify an outbound Meta API error as transient (safe to retry) or not.
 * Retries only transient conditions: network/timeout, 5xx, and 429 rate-limit
 * (Meta itself recommends backing off on 429). 4xx client errors (400 invalid
 * payload, 401/403 auth) are permanent and must NOT be retried. Robust to both
 * real axios errors and plain thrown objects so retry decisions never change
 * based on how the transport throws.
 */
export function isTransientMetaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { response?: { status?: unknown }; code?: string; request?: unknown };

  const status = typeof e.response?.status === "number" ? e.response.status : undefined;
  if (status !== undefined) {
    if (status === 429) return true;
    if (status >= 500 && status <= 599) return true;
    return false;
  }

  const code = e.code || "";
  if (
    code === "ECONNABORTED" ||
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    code === "EAI_AGAIN" ||
    code === "EPIPE"
  ) {
    return true;
  }

  // Axios network error shape: a `request` was made but no `response` received.
  if (e.request != null && e.response == null) return true;

  return false;
}

export class MetaMessenger {
  private token: string;
  private graphVersion: string;
  private transport: (url: string, body: unknown, headers: Record<string, string>) => Promise<unknown>;
  private retry: RetryOptions;

  constructor(opts: MetaMessengerOptions) {
    this.token = opts.pageAccessToken;
    this.graphVersion = opts.graphVersion || "v26.0";
    this.retry = {
      maxAttempts: 3,
      baseDelayMs: 250,
      shouldRetry: isTransientMetaError,
    };
    this.transport =
      opts.transport ||
      (async (url, body, headers) => {
        const res = await axios.post(url, body, {
          headers: { "Content-Type": "application/json", ...headers },
          timeout: 30000,
        });
        return res.data;
      });
  }

  get configured(): boolean {
    return !!this.token;
  }

  /**
   * Send a text message to a PSID on the given platform.
   * @returns the recipient / message id from the API, or null on failure.
   */
  async sendText(
    platform: MetaPlatform,
    recipientId: string,
    text: string
  ): Promise<{ recipientId?: string; messageId?: string }> {
    aiDebug("messenger.sendText_start", {
      platform,
      recipientIdLength: recipientId?.length || 0,
      textLength: text?.length || 0,
      hasToken: !!this.token,
      graphVersion: this.graphVersion,
    });

    if (!this.token) {
      throw new Error("MetaMessenger: page access token not configured");
    }
    // Validate inputs
    if (!recipientId || typeof recipientId !== "string") {
      throw new Error("MetaMessenger: recipientId is required");
    }
    if (!text || typeof text !== "string") {
      throw new Error("MetaMessenger: text is required");
    }
    if (text.length > 4096) {
      // Meta's text message cap; truncate safely to avoid permanent 4xx.
      text = text.substring(0, 4096);
    }
    const pageId = process.env.META_PAGE_ID;
    if (!pageId) {
      throw new Error("MetaMessenger: META_PAGE_ID not configured");
    }
    const base = `https://graph.facebook.com/${this.graphVersion}/${pageId}/messages`;
    // Use the Authorization header (Bearer) instead of putting the access
    // token in the URL query string. Tokens in query strings get logged by
    // intermediate proxies, server access logs, and CDN edge nodes.
    const url = base;
    const body = {
      recipient: { id: recipientId },
      messaging_type: "RESPONSE",
      message: { text },
    };
    // Transient-only bounded retry: a 5xx/429/timed-out send is retried, but a
    // permanent 4xx fails immediately so we never duplicate side effects.
    let data: any;
    try {
      data = await withRetry(() =>
        this.transport(url, body, { Authorization: `Bearer ${this.token}` }),
        this.retry
      );
    } catch (err: any) {
      // Log detailed error from Meta Graph API (no customer content or secrets).
      if (err.response) {
        console.error("[AI-MESSENGER] Meta send failed", JSON.stringify({
          status: err.response.status,
          statusText: err.response.statusText,
          errorCode: err.response.data?.error?.code,
          errorType: err.response.data?.error?.type,
          errorSubcode: err.response.data?.error?.error_subcode,
          fbtrace_id: err.response.data?.error?.fbtrace_id,
        }));
      } else {
        console.error("[AI-MESSENGER] Meta send failed (no response):", err instanceof Error ? err.message : String(err));
      }
      throw err;
    }
    aiDebug("messenger.sendText_success", {
      recipientId: data?.recipient_id,
      messageId: data?.message_id,
    });
    return {
      recipientId: data?.recipient_id,
      messageId: data?.message_id,
    };
  }
}
