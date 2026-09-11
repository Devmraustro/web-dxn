// ---------------------------------------------------------------------------
// DXN Store — deterministic environment loading for the seed CLI.
//
// Aim:
//   - Production provisioning MUST read `.env.production.local` when present,
//     and MUST NOT silently fall back to the local dev `.env` (which points at
//     localhost and can never be used for production provisioning).
//   - Normal local development keeps working: if `.env.production.local` does
//     not exist, `.env` is used (or the current process environment if the
//     operator supplies vars explicitly).
//   - Values already present in `process.env` (shell / CI) always win; loaded
//     files only fill variables that are otherwise unset. This keeps secrets
//     out of repo files while allowing out-of-band overrides.
//
// Preflight validation runs BEFORE any network connection and reports only
// non-sensitive state (presence, scheme, "is placeholder", "is localhost") —
// never the actual values.
// ---------------------------------------------------------------------------

import path from "path";
import fs from "fs";
import dotenv from "dotenv";

const PROD_ENV_FILE = ".env.production.local";
const DEV_ENV_FILE = ".env";

/** Known placeholder that MUST never be shipped as a real value. */
export const PLACEHOLDER_PASSWORD = "change_me_immediately";
/** Recognised redaction marker (defensive guard; never echoes the value). */
const REDACTION_MARKER = "[SENSITIVE]";
/** Scheme anchors accepted by mongoose's connection string parser. */
const MONGO_SCHEME = /^mongodb(\+srv)?:\/\//i;
/** Local-only hosts that can never be a production target. */
const LOCAL_HOST = /(?:^|[^a-z0-9])localhost(?:$|[^a-z0-9])|127\.0\.0\.1|0\.0\.0\.0|\[?::1\]?/i;

/** Pick the seed env file to load. Returns null when nothing exists. */
export function resolveSeedEnvFile(cwd = process.cwd()): string | null {
  const explicit = process.env.SEED_ENV_FILE?.trim();
  if (explicit) {
    const p = path.resolve(cwd, explicit);
    return fs.existsSync(p) ? p : null;
  }
  const prod = path.resolve(cwd, PROD_ENV_FILE);
  if (fs.existsSync(prod)) return prod;
  const dev = path.resolve(cwd, DEV_ENV_FILE);
  if (fs.existsSync(dev)) return dev;
  return null;
}

/** Human-readable label for the resolved env file (basename or "(process env)"). */
export function describeSeedEnvFile(pathname: string | null): string {
  if (!pathname) return "current process environment";
  return path.basename(pathname) === DEV_ENV_FILE
    ? `${path.basename(pathname)} (development)`
    : path.basename(pathname);
}

/** Load the resolved file into process.env without overriding existing vars. */
export function loadSeedEnv(cwd = process.cwd()): { file: string | null; overridden: string[] } {
  const file = resolveSeedEnvFile(cwd);
  if (!file) return { file: null, overridden: [] };

  const parsed = dotenv.parse(fs.readFileSync(file, "utf8"));
  const overridden: string[] = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    } else {
      overridden.push(key);
    }
  }
  return { file, overridden };
}

export interface SeedPreflight {
  uri: string | undefined;
  email: string | undefined;
  password: string | undefined;
  requireAdmin: boolean;
  /** When true, localhost URIs are rejected (production intent). */
  forbidLocalhost?: boolean;
}

export type PreflightViolation =
  | "missing-uri"
  | "bad-scheme"
  | "localhost"
  | "redacted-uri"
  | "missing-email"
  | "redacted-email"
  | "missing-password"
  | "placeholder-password"
  | "redacted-password";

/**
 * Return the list of non-sensitive violations (empty = OK). Never throws,
 * never prints values. Callers should map each code to a safe message.
 */
export function preflightSeed(v: SeedPreflight): PreflightViolation[] {
  const violations: PreflightViolation[] = [];

  if (!v.uri) {
    violations.push("missing-uri");
  } else if (v.uri.includes(REDACTION_MARKER)) {
    violations.push("redacted-uri");
  } else if (!MONGO_SCHEME.test(v.uri)) {
    violations.push("bad-scheme");
  } else if (v.forbidLocalhost && LOCAL_HOST.test(v.uri)) {
    violations.push("localhost");
  }

  if (v.requireAdmin) {
    if (!v.email) {
      violations.push("missing-email");
    } else if (v.email.includes(REDACTION_MARKER)) {
      violations.push("redacted-email");
    }

    if (!v.password) {
      violations.push("missing-password");
    } else if (v.password.includes(REDACTION_MARKER)) {
      violations.push("redacted-password");
    } else if (v.password === PLACEHOLDER_PASSWORD) {
      violations.push("placeholder-password");
    }
  }

  return violations;
}

/** Human-readable, non-sensitive explanations for each violation. */
export const PREFLIGHT_MESSAGES: Record<PreflightViolation, string> = {
  "missing-uri": "MONGODB_URI is not set",
  "bad-scheme": "MONGODB_URI must start with mongodb:// or mongodb+srv://",
  "localhost": "MONGODB_URI must not point to localhost/127.0.0.1/::1 (production target required)",
  "redacted-uri": "MONGODB_URI contains only a redaction marker — real value must be supplied out-of-band",
  "missing-email": "ADMIN_EMAIL is not set",
  "redacted-email": "ADMIN_EMAIL contains only a redaction marker — real value must be supplied out-of-band",
  "missing-password": "ADMIN_PASSWORD is not set",
  "placeholder-password": "ADMIN_PASSWORD must not be the known placeholder",
  "redacted-password": "ADMIN_PASSWORD contains only a redaction marker — real value must be supplied out-of-band",
};