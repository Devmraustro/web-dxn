/**
 * Phase 22 — Robust multilingual catalog search.
 *
 * Arabic / Darija / French product queries must retrieve real catalog items.
 * Raw substring matching fails on:
 *   - the Arabic definite article "ال" (e.g. query "القهوة" vs title "قهوة"),
 *   - Arabic diacritics (تً/ّ/ـ),
 *   - attached punctuation ("القهوة؟"),
 *   - Latin/Arabic transliteration differences.
 *
 * These helpers normalize query terms and catalog text so a term is a
 * substring match in a normalized space. Shared by both the mongoose-backed
 * data access and the in-memory test fake so behavior is identical.
 */

/** Strip Arabic diacritics, punctuation and collapse whitespace. */
export function normalizeText(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, "") // Arabic diacritics
    .replace(/[؟?!,.،;:()\[\]'"\-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Remove a leading Arabic definite article ("ال") from a term. */
export function stripArticle(t: string): string {
  // Only strip when preceded by a word boundary or string start.
  return normalizeText(t).replace(/^ال/, "");
}

/**
 * Split a query into meaningful search terms: normalized, punctuation-free,
 * and with a sensible minimum length after article removal.
 */
export function queryTerms(query: string): string[] {
  return normalizeText(query)
    .split(/\s+/)
    .filter((t) => stripArticle(t).length > 1)
    .slice(0, 8); // bounded: never explode into a huge per-term search
}

/**
 * Does a single normalized haystack string match any query term?
 * - term-core is a substring of the haystack (e.g. "قهوة" in "قهوة dxn"),
 * - or the haystack is a substring of the term-core (partial transliteration,
 *   e.g. query "lingzhi cafe" vs title "café").
 */
export function haystackMatchesTerm(haystackNorm: string, term: string): boolean {
  const core = stripArticle(term);
  if (core.length < 2) return false;
  if (haystackNorm.includes(core)) return true;
  if (core.length >= 3 && haystackNorm.length >= 3 && core.includes(haystackNorm)) return true;
  return false;
}

/**
 * Return true if any term of `query` matches the normalized concatenation of
 * the catalog entry's searchable fields (title, slug, category, sku).
 */
export function matchesQuery(fields: string[], query: string): boolean {
  const terms = queryTerms(query);
  if (terms.length === 0) return false;
  const hay = normalizeText(fields.join(" "));
  return terms.some((t) => haystackMatchesTerm(hay, t));
}
