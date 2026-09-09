/**
 * Shared regex-escaping helper.
 *
 * Any time untrusted user input is interpolated into a RegExp source (search
 * queries, wilaya lookups, knowledge-base lookups), it MUST be escaped here
 * first so the user payload is treated as a literal string. This prevents both
 * regex injection and ReDoS payloads such as `(a+)+$`.
 */
export const escapeRegex = (s: string): string =>
  (s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
