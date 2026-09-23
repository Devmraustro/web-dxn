export const VALID_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 100;
export const MAX_INPUT_LENGTH = 200;

const ARABIC_TO_LATIN: Record<string, string> = {
  آ: "a", أ: "a", إ: "e", ا: "a", ب: "b", ت: "t", ث: "th",
  ج: "j", ح: "h", خ: "kh", د: "d", ذ: "dh", ر: "r", ز: "z",
  س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z", ع: "a",
  غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n",
  ه: "h", و: "w", ي: "y", ة: "h", ى: "a", ء: "a", ئ: "y", ؤ: "w",
};

const DIACRITICS_RE = /[\u0300-\u036f]/g;
const NON_SLUG_RE = /[^a-z0-9]+/g;

export function slugify(input: string): string {
  const decomposed = input.normalize("NFKD").replace(DIACRITICS_RE, "");
  let latin = "";
  for (const char of decomposed) {
    latin += ARABIC_TO_LATIN[char] ?? char;
  }
  return latin
    .toLowerCase()
    .replace(NON_SLUG_RE, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH);
}

export function isValidSlug(value: string): boolean {
  return value.length <= MAX_SLUG_LENGTH && VALID_SLUG_RE.test(value);
}

export function isUrlLike(value: string): boolean {
  const v = value.trim();
  return (
    /^https?:\/\//i.test(v) ||
    /^www\./i.test(v) ||
    /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/|$)/i.test(v) ||
    /facebook\.com|instagram\.com/i.test(v) ||
    /\/share\/?/i.test(v) ||
    v.includes("://") ||
    v.includes("/") ||
    v.includes("?") ||
    v.includes("#") ||
    /%[0-9a-f]{2}/i.test(v)
  );
}

export function isPollutedSlug(value: string): boolean {
  return isUrlLike(value) || !isValidSlug(value);
}

export function buildProductSlug(input: {
  arTitle?: string;
  frTitle?: string;
  sku?: string;
  reserved?: ReadonlySet<string>;
}): string {
  const source = input.frTitle?.trim() || input.arTitle?.trim() || input.sku?.trim() || "";
  let base = slugify(source);
  if (base.startsWith("dxn-")) {
    base = base.slice(4);
  }
  if (!base) return "";

  const reserved = input.reserved ?? new Set<string>();
  let candidate = base;
  let n = 2;
  while (reserved.has(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate.slice(0, MAX_SLUG_LENGTH);
}

export type SlugPlanStatus = "keep" | "repair" | "review";

export interface ProductSlugRow {
  _id: string;
  sku?: string;
  slug: string;
  arTitle?: string;
  frTitle?: string;
}

export interface SlugPlanEntry {
  _id: string;
  sku?: string;
  oldSlug: string;
  status: SlugPlanStatus;
  newSlug?: string;
  manualReview: boolean;
  reason: string;
}

const ARABIC_RE = /[\u0600-\u06FF]/;

export function buildProductSlugPlan(
  rows: ProductSlugRow[],
  reserved?: ReadonlySet<string>
): SlugPlanEntry[] {
  const used = new Set<string>(reserved ?? []);
  const sorted = [...rows].sort((a, b) => String(a._id).localeCompare(String(b._id)));
  const entries: SlugPlanEntry[] = [];

  for (const row of sorted) {
    const oldSlug = row.slug;
    if (!isPollutedSlug(oldSlug)) {
      used.add(oldSlug);
      entries.push({
        _id: row._id,
        sku: row.sku,
        oldSlug,
        status: "keep",
        newSlug: oldSlug,
        manualReview: false,
        reason: "already a valid slug",
      });
      continue;
    }

    const frTitle = row.frTitle?.trim();
    const arTitle = row.arTitle?.trim();
    const sku = row.sku?.trim();
    const identity = frTitle || arTitle || sku || "";

    if (!identity) {
      entries.push({
        _id: row._id,
        sku: row.sku,
        oldSlug,
        status: "review",
        manualReview: true,
        reason: "no title/sku identity to derive a slug from",
      });
      continue;
    }

    const newSlug = buildProductSlug({
      arTitle,
      frTitle,
      sku,
      reserved: used,
    });

    if (!newSlug) {
      entries.push({
        _id: row._id,
        sku: row.sku,
        oldSlug,
        status: "review",
        manualReview: true,
        reason: "polluted but could not derive a clean slug",
      });
      continue;
    }

    used.add(newSlug);
    const arabicOnly = !frTitle && !!arTitle && ARABIC_RE.test(arTitle);
    entries.push({
      _id: row._id,
      sku: row.sku,
      oldSlug,
      status: "repair",
      newSlug,
      manualReview: arabicOnly,
      reason: arabicOnly
        ? "transliterated from Arabic title (review recommended)"
        : "repaired from product identity",
    });
  }

  return entries;
}