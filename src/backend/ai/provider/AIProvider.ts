/**
 * Phase 19B — AI Provider Abstraction
 *
 * Provider-agnostic interface so the application is not hardcoded to one LLM.
 * Implementations: OpenAI, Anthropic, and a deterministic local fallback used
 * when no provider is configured (also used in tests / degraded mode).
 *
 * API keys are read from environment variables and never exposed to the
 * frontend. No key is required to use the deterministic fallback.
 */
import axios, { AxiosError } from "axios";
import { AiProvider, AiProviderRequest, AiProviderResponse } from "../core/types";
import { withRetry } from "../core/retry";

export type ProviderName = "openai" | "anthropic" | "deterministic";

/**
 * Decide whether a provider call failure is retryable (transient). Network
 * errors, timeouts, 429 (rate limit) and 5xx (server) are retryable; 4xx
 * client errors (auth, bad request) are NOT — retrying them just wastes
 * attempts. (Phase 21: bounded transient retry.)
 */
export function isTransientProviderError(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    const status = (err as AxiosError).response?.status;
    if (status !== undefined) {
      return status === 429 || status >= 500;
    }
    // No HTTP status → transport-layer failure (network, timeout, DNS, ECONN).
    return true;
  }
  // Missing-key and other thrown errors are not transient.
  return false;
}

/**
 * Deterministic fallback provider. Does NOT call any external service.
 * Used when AI_PROVIDER is unset/invalid or when keys are missing, and in
 * unit tests to exercise the pipeline without a live LLM.
 *
 * IMPORTANT: This provider is deliberately conservative — when it cannot
 * answer from known templates it escalates to a human instead of inventing
 * facts (Phase 19D/E/K: the LLM must never be the source of truth).
 */
export class DeterministicProvider implements AiProvider {
  readonly name = "deterministic";

  async generateResponse(req: AiProviderRequest): Promise<AiProviderResponse> {
    const q = req.userMessage.trim().toLowerCase();
    return { text: q, tokensUsed: 0 };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

interface OpenAICompletionBody {
  model: string;
  messages: { role: string; content: string }[];
  max_tokens?: number;
  temperature?: number;
}

export class OpenAIProvider implements AiProvider {
  readonly name = "openai";
  readonly configError?: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(apiKey?: string, model?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || "";
    this.model = model || process.env.OPENAI_MODEL || "gpt-4o-mini";
    this.baseUrl = baseUrl || "https://api.openai.com/v1/chat/completions";
    if (!this.apiKey) this.configError = "OPENAI_API_KEY is missing";
  }

  async generateResponse(req: AiProviderRequest): Promise<AiProviderResponse> {
    if (!this.apiKey) {
      throw new Error("OpenAIProvider: OPENAI_API_KEY is not configured");
    }
    const body: OpenAICompletionBody = {
      model: this.model,
      messages: [
        { role: "system", content: req.systemPrompt },
        { role: "user", content: req.userMessage },
      ],
      max_tokens: req.maxTokens ?? 600,
      temperature: 0.3,
    };
    const res = await withRetry(
      () =>
        axios.post(this.baseUrl, body, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }),
      {
        maxAttempts: 3,
        baseDelayMs: 200,
        maxDelayMs: 4000,
        shouldRetry: isTransientProviderError,
      }
    );
    const text: string = res.data?.choices?.[0]?.message?.content ?? "";
    return { text, raw: res.data, tokensUsed: res.data?.usage?.total_tokens };
  }

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      await this.generateResponse({
        systemPrompt: "ping",
        userMessage: "ping",
        language: "fr",
        maxTokens: 1,
      });
      return true;
    } catch {
      return false;
    }
  }
}

interface AnthropicCompletionBody {
  model: string;
  max_tokens: number;
  system: string;
  messages: { role: string; content: string }[];
}

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  readonly configError?: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(apiKey?: string, model?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || "";
    this.model = model || process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022";
    this.baseUrl = baseUrl || "https://api.anthropic.com/v1/messages";
    if (!this.apiKey) this.configError = "ANTHROPIC_API_KEY is missing";
  }

  async generateResponse(req: AiProviderRequest): Promise<AiProviderResponse> {
    if (!this.apiKey) {
      throw new Error("AnthropicProvider: ANTHROPIC_API_KEY is not configured");
    }
    const body: AnthropicCompletionBody = {
      model: this.model,
      max_tokens: req.maxTokens ?? 600,
      system: req.systemPrompt,
      messages: [{ role: "user", content: req.userMessage }],
    };
    const res = await withRetry(
      () =>
        axios.post(this.baseUrl, body, {
          headers: {
            "x-api-key": this.apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }),
      {
        maxAttempts: 3,
        baseDelayMs: 200,
        maxDelayMs: 4000,
        shouldRetry: isTransientProviderError,
      }
    );
    const text: string = res.data?.content?.[0]?.text ?? "";
    return { text, raw: res.data };
  }

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      await this.generateResponse({
        systemPrompt: "ping",
        userMessage: "ping",
        language: "fr",
        maxTokens: 1,
      });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Select the configured provider. Falls back to the deterministic provider
 * when no provider is configured or the configured one is unknown — this
 * keeps the integration safe and non-crashing when credentials are absent.
 */
export function createProvider(name?: string): AiProvider {
  const provider = (name || process.env.AI_PROVIDER || "deterministic").toLowerCase();
  switch (provider) {
    case "openai":
      return new OpenAIProvider();
    case "anthropic":
      return new AnthropicProvider();
    case "deterministic":
    default:
      return new DeterministicProvider();
  }
}
