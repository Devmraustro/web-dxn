/**
 * Normalize the public base-origin used to build absolute URLs (sitemap,
 * robots.txt Sitemap line, upload image URLs). Guards against two common
 * misconfigurations: a pasted `BASE_URL=` assignment prefix (the Vercel env
 * UI shows `NAME=value` and the whole line is sometimes pasted into the value
 * field) and a trailing slash.
 *
 * This module is deliberately side-effect-free (no process.env reads at import)
 * so storage / seo / upload code can use it even under `NODE_ENV=production`
 * without tripping the env.ts JWT_SECRET import guard.
 */
export function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const cleaned = value.trim().replace(/^BASE_URL\s*=\s*/i, "");
  if (!cleaned) return fallback;
  return cleaned.replace(/\/+$/, "");
}