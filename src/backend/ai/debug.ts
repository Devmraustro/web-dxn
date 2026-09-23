/**
 * Privacy-safe diagnostic logging for the AI sales brain.
 *
 * The AI modules previously emitted a `[DIAGNOSTIC-*]` firehose on every
 * message: full body structures, 50-char customer message previews, sender-ID
 * prefixes and reply previews. That leaks customer PII to function logs even
 * when nothing is actually sent (PAUSED mode was the noisiest path).
 *
 * This helper routes those traces behind an explicit `AI_DEBUG=1` opt-in. With
 * the flag OFF (the default) the AI feature stays silent on normal flows and
 * only logs genuine failures (already stripped of customer content). Callers
 * never build data that isn't needed, and any state included here is passed
 * through JSON.stringify with no customer message text or identifiers.
 */
function aiDebugEnabled(): boolean {
  return process.env.AI_DEBUG === "1" || process.env.AI_DEBUG === "true";
}

/**
 * Emit a debug trace ONLY when AI_DEBUG is enabled. `data` is stringified with
 * a safe replacer so huge or oddly-shaped payloads cannot blow up the logger.
 */
export function aiDebug(label: string, data?: unknown): void {
  if (!aiDebugEnabled()) return;
  const safe = data === undefined ? "" : safeStringify(data);
  // eslint-disable-next-line no-console
  console.log(`[AI-DEBUG] ${label}${safe ? ` ${safe}` : ""}`);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, redactReplacer);
  } catch {
    return String(value);
  }
}

/** Drop anything with the shape of customer PII (sender ids, tokens, secrets). */
const SENSITIVE_KEYS = /sender|token|secret|password|authorization|psid|recipient|customer/i;

function redactReplacer(key: string, value: unknown): unknown {
  if (typeof key === "string" && SENSITIVE_KEYS.test(key)) return "[REDACTED]";
  return value;
}