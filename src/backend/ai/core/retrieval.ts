/**
 * Phase 19D/19E/19G — Retrieval Layer & Recommendation
 *
 * The LLM is NEVER the source of truth for business data (products, packs,
 * offers, shipping, payment methods, store settings, FAQ — Phase 19D). All
 * factual answers are produced by retrieving CURRENT data from the catalog.
 *
 * The DataAccess interface decouples retrieval from the concrete database so
 * it can be unit-tested with an in-memory fake and wired to mongoose in the
 * production adapter.
 */
import { BusinessContext, CatalogItem, Intent, OfferInfo, ShippingInfo } from "./types";

/**
 * Contract the orchestrator needs to answer business questions truthfully.
 * Implement with the real models (mongoose) for production; use an in-memory
 * fake for tests.
 */
export interface DataAccess {
  searchCatalog(query: string): Promise<CatalogItem[]>;
  getCatalog(): Promise<CatalogItem[]>;
  getPacks(): Promise<CatalogItem[]>;
  getActiveOffers(): Promise<OfferInfo[]>;
  getShippingInfo(wilaya?: string): Promise<ShippingInfo>;
  getFaq(language: string): Promise<{ question: string; answer: string; language: string }[]>;
  getStoreSettings(): Promise<BusinessContext["store"]>;
}

export interface RetrievalResult {
  answer?: string;
  products: CatalogItem[];
  packs: CatalogItem[];
  offers: OfferInfo[];
  shipping?: ShippingInfo;
  performedRetrieval: boolean;
  confidence: number;
}

/**
 * Run the retrieval for a given intent + query.
 */
export async function retrieve(
  intent: Intent,
  query: string,
  language: string,
  da: DataAccess
): Promise<RetrievalResult> {
  switch (intent) {
    case Intent.PRODUCT_INFO:
    case Intent.PRODUCT_PRICE:
    case Intent.PRODUCT_AVAILABILITY:
    case Intent.PRODUCT_RECOMMENDATION:
    case Intent.PACK_INFO:
    case Intent.PRODUCT_LINK:
    case Intent.CATALOG:
    case Intent.OFFER_INFO:
    case Intent.OUT_OF_STOCK: {
      const products = await da.searchCatalog(query);
      const packs = await da.getPacks();
      const offers = await da.getActiveOffers();
      return { products, packs, offers, performedRetrieval: true, confidence: 0.9 };
    }
    case Intent.SHIPPING: {
      const shipping = await da.getShippingInfo(extractWilayaFromQuery(query));
      return { products: [], packs: [], offers: [], shipping, performedRetrieval: true, confidence: 0.95 };
    }
    default:
      return { products: [], packs: [], offers: [], performedRetrieval: false, confidence: 0.3 };
  }
}

function extractWilayaFromQuery(query: string): string | undefined {
  const known = [
    "الجزائر", "وهران", "سطيف", "بجاية", "البليدة", "برج بوعريريج", "تيزي وزو",
    "constantine", "oran", "setif", "bejaia", "blida", "alger", "tizi ouzou",
  ];
  const lower = query.toLowerCase();
  for (const w of known) {
    if (lower.includes(w.toLowerCase())) return w;
  }
  return undefined;
}

/**
 * Phase 19G — Recommendation Engine.
 * Returns the most relevant catalog items for a free-form request like
 * "نحب حاجة للرياضة". Matches against catalog category/title metadata.
 */
export function recommend(
  query: string,
  catalog: CatalogItem[],
  language: string
): { items: CatalogItem[]; matchedTerms: string[] } {
  const lower = query.toLowerCase();
  const termToCategory: [string, string][] = [
    ["sport", "sport"],
    ["الرياضة", "sport"],
    ["رياضة", "sport"],
    ["gym", "sport"],
    ["fit", "sport"],
    ["طاقة", "energy"],
    ["energy", "energy"],
    ["الطاقة", "energy"],
    ["coffee", "coffee"],
    ["café", "coffee"],
    ["cafe", "coffee"],
    ["قهوة", "coffee"],
    ["القهوة", "coffee"],
    ["tea", "tea"],
    ["thé", "tea"],
    ["شاي", "tea"],
    ["gingember", "ginger"],
    ["gingembre", "ginger"],
    ["زنجبيل", "ginger"],
    ["study", "study"],
    ["étude", "study"],
    ["concentration", "study"],
    ["تركيز", "study"],
    ["دراسة", "study"],
    ["مذاكرة", "study"],
    ["immunité", "immunity"],
    ["immunite", "immunity"],
    ["مناعة", "immunity"],
    ["المناعة", "immunity"],
    ["concentration", "concentration"],
    ["تركيز", "concentration"],
    ["sommeil", "sleep"],
    ["نوم", "sleep"],
  ];
  const matchedTerms: string[] = [];
  for (const [term, category] of termToCategory) {
    if (lower.includes(term)) {
      matchedTerms.push(term);
    }
  }
  const cats = new Set(matchedTerms.map((t) => termToCategory.find(([term]) => term === t)?.[1]).filter(Boolean) as string[]);
  const items = catalog.filter((it) => {
    if (cats.size === 0) return false;
    const haystack = `${it.title} ${it.category || ""}`.toLowerCase();
    // Grounded matching (Phase 5 F-5): match the mapped category on catalog
    // metadata AND the customer's own term against the title/category, so a
    // seed catalog with no category metadata still recommends real products
    // ("انصحني بقهوة" → the coffee products whose titles contain "قهوة").
    if ([...cats].some((c) => haystack.includes(c))) return true;
    return matchedTerms.some((t) => t.length >= 2 && haystack.includes(t));
  });
  return { items, matchedTerms };
}

/**
 * Normalize a pack name/token (lowercase, unaccented, alphanumeric-only) so
 * "découverte" matches slug "pack-decouverte" across scripts.
 */
export function normalizePackToken(token: string): string {
  return (token || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0600-\u06ff]/g, "");
}

/**
 * Scope a pack request to a SPECIFIC pack when the message names one (Phase 5
 * F-7). Returns undefined when no pack matches — the caller must then answer
 * "not found" rather than dump the whole pack catalog.
 */
export function matchPack(
  packs: CatalogItem[],
  token: string | undefined
): CatalogItem | undefined {
  if (!token) return undefined;
  const t = normalizePackToken(token);
  if (!t) return undefined;
  return packs.find((p) => {
    const hay = normalizePackToken(`${p.slug} ${p.title}`);
    return hay.includes(t);
  });
}
