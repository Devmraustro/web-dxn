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

/** Remove leading Arabic prepositions (لـ, بـ, كـ, فـ, وـ) from a term. */
export function stripArabicPrepositions(t: string): string {
  return normalizeText(t).replace(/^[لبكف]/, "");
}

/**
 * Controlled product aliases for common transliteration variants.
 * This is a deterministic, catalog-driven mapping — NOT fuzzy matching.
 * Add entries here when a known product has a common short name or
 * transliteration that users type but that doesn't substring-match.
 * Format: normalizedAlias -> [product identifiers: slug, sku, or title keywords]
 * Only exact normalized token matches are used (no substring/partial).
 */
export const PRODUCT_ALIASES: Record<string, string[]> = {
  // DXN-RG: reishi-gano / ريشي غانو / Reishi Gano
  "gano": ["reishi-gano", "reishi gano", "reishi", "gano", "reishi-gano"],
  "ganozhi": ["reishi-gano", "reishi gano", "reishi", "gano"],
  "reishi": ["reishi-gano", "reishi gano", "reishi", "gano"],
  "rg": ["reishi-gano"],
  // DXN-LC3: lingzhi-coffee-3in1 / قهوة الريشي 3 في 1 / Café Lingzhi 3-en-1
  "lc3": ["lingzhi-coffee-3in1", "lingzhi coffee 3in1"],
  "3in1": ["lingzhi-coffee-3in1", "lingzhi coffee 3in1"],
  "lingzhi": ["lingzhi-coffee-3in1", "lingzhi-coffee", "lingzhi coffee", "lingzhi"],
  // DXN-LC: lingzhi-coffee / قهوة الريشي بودرة / Café Lingzhi
  "lc": ["lingzhi-coffee", "lingzhi coffee"],
  // DXN-BC: black-coffee / القهوة السوداء / Café Noir
  "bc": ["black-coffee", "black coffee"],
  "black coffee": ["black-coffee", "black coffee"],
  "cafe noir": ["black-coffee", "cafe noir"],
  "القهوة السوداء": ["black-coffee", "القهوة السوداء"],
  // DXN-SPI: spirulina / سبيرولينا / Spiruline
  "spi": ["spirulina"],
  "spiruline": ["spirulina"],
  "سبيرولينا": ["spirulina"],
  // DXN-GL: ganocelium / غانوسيليوم / Ganocelium
  "gl": ["ganocelium"],
  "ganocelium": ["ganocelium"],
  "غانوسيليوم": ["ganocelium"],
  // DXN-COR: cordyceps / كورديسيبس / Cordyceps
  "cor": ["cordyceps"],
  "cordyceps": ["cordyceps"],
  "كورديسيبس": ["cordyceps"],
  // DXN-MOR: morinzhi / مورينزي / Morinzhi
  "mor": ["morinzhi"],
  "morinzhi": ["morinzhi"],
  "مورينزي": ["morinzhi"],
};

/**
 * Split a query into meaningful search terms: normalized, punctuation-free,
 * and with a sensible minimum length after article removal.
 * Also expands known aliases into their target identifiers.
 */
export function queryTerms(query: string): string[] {
  const normalized = normalizeText(query);
  const baseTerms = normalized
    .split(/\s+/)
    .map(stripArabicPrepositions)
    .map(stripArticle)
    .filter((t) => t.length > 1)
    .slice(0, 8);

  // Expand aliases: if a term exactly matches a known alias, add its targets
  const expanded: string[] = [...baseTerms];
  for (const term of baseTerms) {
    const aliasTargets = PRODUCT_ALIASES[term];
    if (aliasTargets) {
      expanded.push(...aliasTargets);
    }
  }
  return expanded;
}

/**
 * Does a single normalized haystack string match any query term?
 * - term-core is a substring of the haystack (e.g. "قهوة" in "قهوة dxn"),
 * - or the haystack is a substring of the term-core (partial transliteration,
 *   e.g. query "lingzhi cafe" vs title "café").
 */
export function haystackMatchesTerm(haystackNorm: string, term: string): boolean {
  const core = stripArticle(stripArabicPrepositions(term));
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

/**
 * Find the best matching catalog items for a query, with confidence scoring.
 * Returns items sorted by match confidence (highest first).
 * This enables the orchestrator to detect ambiguity vs. confident matches.
 */
export interface MatchResult {
  item: any;
  score: number;
  matchedTerms: string[];
}

export function findBestMatches(
  items: any[],
  query: string,
  options: { minScore?: number; maxResults?: number } = {}
): MatchResult[] {
  const { minScore = 0.3, maxResults = 5 } = options;
  const terms = queryTerms(query);
  if (terms.length === 0) return [];

  const results: MatchResult[] = [];
  for (const item of items) {
    const hay = normalizeText([item.title, item.slug, item.category || "", item.id || ""].join(" "));
    const matchedTerms: string[] = [];
    let score = 0;

    for (const term of terms) {
      const core = stripArticle(stripArabicPrepositions(term));
      if (core.length < 2) continue;

      // Exact token match in any field (highest confidence)
      const fields = [item.title, item.slug, item.category || "", item.id || ""].map(normalizeText);
      const exactFieldMatch = fields.some(f => f.split(/\s+/).includes(core));
      if (exactFieldMatch) {
        score += 1.0;
        matchedTerms.push(term);
        continue;
      }

      // Substring match (good confidence)
      if (hay.includes(core)) {
        score += 0.7;
        matchedTerms.push(term);
        continue;
      }

      // Reverse substring (partial transliteration)
      if (core.length >= 3 && hay.length >= 3 && core.includes(hay)) {
        score += 0.5;
        matchedTerms.push(term);
      }
    }

    if (score >= minScore) {
      results.push({ item, score, matchedTerms });
    }
  }

  // Sort by score descending, then by title for stability
  results.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  return results.slice(0, maxResults);
}
