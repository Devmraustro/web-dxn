/**
 * DXN NADZ — Referral Attribution & Optional Membership ID Normalization.
 *
 * SECURITY & BUSINESS RULES:
 * 1. Referral parameters (?ref=facebook|instagram|tiktok|whatsapp, utm_*) are
 *    strictly marketing traffic attribution metadata. They NEVER override or
 *    impersonate the configured official DXN sponsor membership number.
 * 2. Customer DXN membership number at checkout is strictly optional:
 *    - Empty / whitespace / null / undefined -> null
 *    - Non-empty -> normalized alphanumeric (5–24 chars) after stripping
 *      harmless separators (spaces/hyphens). Invalid punctuation/scripts are rejected.
 */

export interface TrafficSourceInput {
  source?: unknown;
  ref?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  landingPath?: unknown;
}

export interface NormalizedTrafficSource {
  source: string;
  ref: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  landingPath: string;
}

const SOURCE_ALIASES: Record<string, string> = {
  fb: "facebook",
  facebook: "facebook",
  ig: "instagram",
  insta: "instagram",
  instagram: "instagram",
  tt: "tiktok",
  tiktok: "tiktok",
  wa: "whatsapp",
  whatsapp: "whatsapp",
  tg: "telegram",
  telegram: "telegram",
  yt: "youtube",
  youtube: "youtube",
  google: "google",
  direct: "direct",
};

function cleanToken(raw: unknown, maxLen = 64): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return "";
  // Keep only safe slug characters [a-z0-9_-]
  const safe = trimmed.replace(/[^a-z0-9_-]/g, "").slice(0, maxLen);
  return safe;
}

function cleanPath(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return "";
  // Strip query/hash and control chars, keep safe URL path characters
  const pathOnly = trimmed.split(/[?#]/)[0].replace(/[^a-zA-Z0-9/_-]/g, "").slice(0, 160);
  return pathOnly || "/";
}

export function normalizeTrafficSource(input?: TrafficSourceInput | null): NormalizedTrafficSource {
  if (!input || typeof input !== "object") {
    return {
      source: "direct",
      ref: "",
      utmSource: "",
      utmMedium: "",
      utmCampaign: "",
      landingPath: "",
    };
  }

  const ref = cleanToken(input.ref, 64);
  const utmSource = cleanToken(input.utmSource, 64);
  const utmMedium = cleanToken(input.utmMedium, 64);
  const utmCampaign = cleanToken(input.utmCampaign, 80);
  const explicitSource = cleanToken(input.source, 64);

  // The explicit `source` channel is canonical; `utmSource` / `ref` are only
  // fallbacks when no explicit source was provided.
  const rawPrimary = explicitSource || utmSource || ref || "direct";
  const source = SOURCE_ALIASES[rawPrimary] || rawPrimary || "direct";

  return {
    source,
    ref,
    utmSource,
    utmMedium,
    utmCampaign,
    landingPath: cleanPath(input.landingPath),
  };
}

export interface DxnMemberIdResult {
  valid: boolean;
  value: string | null;
  error?: string;
}

/**
 * Normalizes an optional DXN membership number.
 * Returns `{ valid: true, value: null }` when empty/omitted.
 */
export function normalizeOptionalDxnMemberId(raw: unknown): DxnMemberIdResult {
  if (raw === null || raw === undefined) {
    return { valid: true, value: null };
  }
  if (typeof raw !== "string") {
    return { valid: false, value: null, error: "Invalid DXN membership number format" };
  }

  const trimmed = raw.trim();
  if (trimmed === "") {
    return { valid: true, value: null };
  }

  // Strip spaces and hyphens commonly typed by members (e.g., "820-123-456" -> "820123456")
  const compact = trimmed.replace(/[\s-]+/g, "").toUpperCase();

  if (!/^[A-Z0-9]{5,24}$/.test(compact)) {
    return {
      valid: false,
      value: null,
      error: "DXN membership number must contain 5 to 24 letters or digits",
    };
  }

  return { valid: true, value: compact };
}

/**
 * Generates a collision-resistant human-readable reference code (e.g. LEAD-20261113-A9F2C1).
 */
export function generateReferenceCode(prefix: "LEAD" | "MSG"): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${y}${m}${d}-${rand}`;
}
