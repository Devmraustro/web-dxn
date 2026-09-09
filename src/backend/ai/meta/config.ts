/**
 * Phase 23 — Meta integration configuration & health status.
 *
 * Centralises reading Meta env configuration and producing a health status that
 * differentiates configuration state WITHOUT ever exposing secrets. The status
 * ladder:
 *
 *   NOT_CONFIGURED              — required env vars missing / integration off
 *   CONFIGURED_NOT_LIVE_VERIFIED — env present but a real two-way exchange has
 *                                  not been confirmed (OWNER ACTION required:
 *                                  run the live Meta test and, once verified,
 *                                  set META_LIVE_VERIFIED=true)
 *   LIVE_VERIFIED               — owner confirmed real messages exchanged on a
 *                                  real Instagram/Facebook account
 *   ERROR                       — configuration is inconsistent (e.g. partial)
 */
export type MetaHealthStatus =
  | "NOT_CONFIGURED"
  | "CONFIGURED_NOT_LIVE_VERIFIED"
  | "LIVE_VERIFIED"
  | "ERROR";

export interface MetaConfig {
  verifyToken: string;
  appSecret: string;
  pageAccessToken: string;
  graphVersion: string;
  liveVerified: boolean;
}

export interface MetaHealth {
  status: MetaHealthStatus;
  /** Which platforms are subscribed (drives webhook configuration). */
  platforms: Array<"instagram" | "facebook">;
  /** Never contains secret material. */
  details: string[];
}

export function getMetaConfig(): MetaConfig {
  const verifyToken = process.env.META_VERIFY_TOKEN || "";
  const appSecret = process.env.META_APP_SECRET || "";
  const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN || "";
  const graphVersion = process.env.META_GRAPH_VERSION || "v26.0";
  const liveVerified = process.env.META_LIVE_VERIFIED === "true";
  return { verifyToken, appSecret, pageAccessToken, graphVersion, liveVerified };
}

export function isMetaConfigured(cfg: MetaConfig): boolean {
  return !!cfg.verifyToken && !!cfg.appSecret && !!cfg.pageAccessToken;
}

export function getMetaHealth(cfg: MetaConfig = getMetaConfig()): MetaHealth {
  const details: string[] = [];
  const kv: Record<string, boolean> = {
    "verify token": !!cfg.verifyToken,
    "app secret": !!cfg.appSecret,
    "page access token": !!cfg.pageAccessToken,
  };
  for (const [label, present] of Object.entries(kv)) {
    if (present) details.push(`${label}: set`);
    else details.push(`${label}: missing`);
  }

  const allSet = Object.values(kv).every(Boolean);
  const anySet = Object.values(kv).some(Boolean);

  if (!allSet && !anySet) {
    return { status: "NOT_CONFIGURED", platforms: [], details };
  }
  if (!allSet) {
    return { status: "ERROR", platforms: [], details };
  }
  if (cfg.liveVerified) {
    return { status: "LIVE_VERIFIED", platforms: ["instagram", "facebook"], details };
  }
  return {
    status: "CONFIGURED_NOT_LIVE_VERIFIED",
    platforms: ["instagram", "facebook"],
    details,
  };
}
