/**
 * Phase 19U — Retry System
 *
 * Safe retries for external calls (Meta, AI provider, Telegram) with
 * exponential backoff and jitter. Avoids duplicate side effects: callers must
 * ensure the underlying operation is idempotent (see meta/webhook idempotency).
 */
export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (err: unknown) => boolean;
}

const DEFAULTS: Required<Pick<RetryOptions, "maxAttempts" | "baseDelayMs" | "maxDelayMs">> = {
  maxAttempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 4000,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? DEFAULTS.maxAttempts;
  const baseDelayMs = opts.baseDelayMs ?? DEFAULTS.baseDelayMs;
  const maxDelayMs = opts.maxDelayMs ?? DEFAULTS.maxDelayMs;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (opts.shouldRetry && !opts.shouldRetry(err)) throw err;
      if (attempt >= maxAttempts) break;
      const exp = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * exp * 0.3;
      const delay = Math.min(exp + jitter, maxDelayMs);
      await sleep(delay);
    }
  }
  throw lastErr;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A retry-safe "at most once" wrapper for idempotent publish operations:
 * runs fn, and if it fails, retries. The caller is responsible for ensuring fn
 * is idempotent (no duplicate side effects).
 */
export function retryOnce<T>(fn: () => Promise<T>): Promise<T> {
  return withRetry(fn, { maxAttempts: 2, baseDelayMs: 150 });
}
