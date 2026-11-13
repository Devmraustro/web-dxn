/**
 * DXN NADZ — Client-Side Referral & Traffic Source Attribution (Phase 9).
 *
 * Captures `?ref=facebook|instagram|tiktok|whatsapp` and UTM query parameters
 * on landing, preserves them across internal navigation, and returns a clean
 * payload for order, recruitment lead, and contact submissions.
 *
 * SECURITY:
 * - Strictly marketing attribution metadata.
 * - Never overrides or impersonates the official DXN sponsor membership number.
 */

export interface StoredTrafficSource {
  source: string;
  ref: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  landingPath: string;
  capturedAt?: string;
}

const STORAGE_KEY = "dxn_nadz_attribution_v1";

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

function sanitizeSlug(raw: string | null | undefined, maxLen = 64): string {
  if (!raw) return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, maxLen);
}

function sanitizePath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/")) return "/";
  const clean = raw.split(/[?#]/)[0].replace(/[^a-zA-Z0-9/_-]/g, "").slice(0, 160);
  return clean || "/";
}

function readStorage(): StoredTrafficSource | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.sessionStorage.getItem(STORAGE_KEY) ||
      window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      source: sanitizeSlug(parsed.source) || "direct",
      ref: sanitizeSlug(parsed.ref),
      utmSource: sanitizeSlug(parsed.utmSource),
      utmMedium: sanitizeSlug(parsed.utmMedium),
      utmCampaign: sanitizeSlug(parsed.utmCampaign, 80),
      landingPath: sanitizePath(parsed.landingPath),
      capturedAt: typeof parsed.capturedAt === "string" ? parsed.capturedAt : undefined,
    };
  } catch {
    return null;
  }
}

function writeStorage(data: StoredTrafficSource): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(data);
    window.sessionStorage.setItem(STORAGE_KEY, serialized);
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Ignore private-mode storage quota errors
  }
}

export function captureReferralFromLocation(search: string, pathname: string): StoredTrafficSource {
  const existing = readStorage();
  const params = new URLSearchParams(search || "");

  const ref = sanitizeSlug(params.get("ref"));
  const utmSource = sanitizeSlug(params.get("utm_source"));
  const utmMedium = sanitizeSlug(params.get("utm_medium"));
  const utmCampaign = sanitizeSlug(params.get("utm_campaign"), 80);

  const hasNewAttribution = Boolean(ref || utmSource || utmMedium || utmCampaign);

  if (hasNewAttribution) {
    const rawPrimary = ref || utmSource || "direct";
    const resolvedSource = SOURCE_ALIASES[rawPrimary] || rawPrimary || "direct";
    const next: StoredTrafficSource = {
      source: resolvedSource,
      ref,
      utmSource,
      utmMedium,
      utmCampaign,
      landingPath: sanitizePath(pathname),
      capturedAt: new Date().toISOString(),
    };
    writeStorage(next);
    return next;
  }

  if (existing) {
    return existing;
  }

  const initial: StoredTrafficSource = {
    source: "direct",
    ref: "",
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    landingPath: sanitizePath(pathname),
    capturedAt: new Date().toISOString(),
  };
  writeStorage(initial);
  return initial;
}

export function getStoredTrafficSource(): Omit<StoredTrafficSource, "capturedAt"> {
  const stored = readStorage();
  if (!stored) {
    return {
      source: "direct",
      ref: "",
      utmSource: "",
      utmMedium: "",
      utmCampaign: "",
      landingPath: typeof window !== "undefined" ? sanitizePath(window.location.pathname) : "/",
    };
  }
  return {
    source: stored.source || "direct",
    ref: stored.ref || "",
    utmSource: stored.utmSource || "",
    utmMedium: stored.utmMedium || "",
    utmCampaign: stored.utmCampaign || "",
    landingPath: stored.landingPath || "/",
  };
}
