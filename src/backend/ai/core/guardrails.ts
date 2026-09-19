/**
 * Phase 19K — AI Safety Guardrails
 *
 * Hard constraints, independent of the LLM. Input guardrails check the
 * CUSTOMER's message (intent + prompt-injection defense). Output guardrails
 * check the LLM PROPOSED response before it is sent (Phase 19L).
 *
 * A proposed response that violates safety is NEVER sent as-is; the pipeline
 * falls back to a safe message and escalates.
 */
export type ViolationType =
  | "medical_claim"
  | "cure_or_treatment"
  | "guarantee"
  | "price_invention"
  | "discount_invention"
  | "stock_invention"
  | "shipping_invention"
  | "promise"
  | "prompt_injection"
  | "unknown";

export interface GuardResult {
  safe: boolean;
  violations: { type: ViolationType; snippet: string }[];
}

// -------------------------------
// Output guardrails — validate a proposed AI response
// -------------------------------

const MEDICAL_VERBS_EN =
  /\b(cures?|heals?|treats?|treatment|cured|cure|remed(y|ies)?|fights?|reverses?|prevents?|soothes?|diagnos(es|e)|guér|guérit|guérir|soigne)\b/i;
const MEDICAL_CONDITIONS =
  /\b(diabetes|diabète|diabète|cancer|cancer|hypertension|high blood pressure|tension|pressure|disease|maladie|tumor|tumeur|infection|infarctus|cardiaque)\b/i;

const OUTPUT_MEDICAL = [
  // English/French: "cures/treats/heals ... diabetes/cancer/disease"
  /\b(cures?|heals?|treats?|fights?|reverses?|prevents?|remed(y|ies)?)\b.{0,50}\b(diabetes|diabète|diabète|cancer|cancer|hypertension|tension|pressure|disease|maladie|tumeur|tumor)\b/i,
  // French verb forms for "cures/treats"
  /\b(guér(irit|it|ira)|guérit le|guérir|soigne le|soigne|traite la|traite le)\b.{0,40}\b(diabète|diabète|cancer|cancer|hypertension|tension|maladie|tumeur)\b/i,
  // Arabic medical claims
  /\b(يعالج|يشفي|يعالج مرض|يداوي|يشافي|يعالج السكري|يداوي السكري|علاج السكري|علاج السرطان)\b/i,
  // Treatment/diagnosis verbs
  MEDICAL_VERBS_EN,
];

const OUTPUT_CURE = [
  // definite cure claims
  /\b(cures?|guérit|guérir|soigne|traite)\b.{0,50}\b(cancer|diabète|diabète|maladie|infection|tumeur|disease)\b/i,
  /\b(guérison|cure|soigne|remède)\b/i,
  /\b(علاج|شفاء|يشفي|تداوي|شفاء تام|يتعالج)\b/i,
];

const OUTPUT_GUARANTEE = [
  /\b(100%|100 %)\b.{0,25}(garanti|garantie|guaranteed|guarantee|rembours)\b/i,
  /\b(garanti|garantie|guaranteed|guarantee|ett garantedes)\b.{0,40}(effet|effect|résultat|result|rembours|perte de poids|perdre du poids|weight loss|efficacité)\b/i,
  /\b(garanti[a-zé]*|garantie)\b.{0,45}\b(résultat|result|perte de poids|perdre du poids|guérison|cure)\b/i,
  /\b(نضمن|مضمون|مضمونة|نضمن النتيجة|نضمن النتائج|النتيجة مضمونة)\b/i,
];

const OUTPUT_price = [
  // Match the FULL currency amount including grouped thousands, so that a
  // fr-FR rendering like "3 600 DA" is validated as a single 3600 amount and
  // not wrongly split into "600 DA" (Phase 22 fix).
  /(\d[\d.,\s\u202f\u00a0]*\s*(?:DA|دج|دينار|dinar))\b/i,
  /(\€\s*[\d.,]+|[\d.,]+\s*€)/i,
  /(\$\s*[\d.,]+|[\d.,]+\s*\$)/i,
];

// Defense-in-depth: the model is never asked for, and must never emit,
// credentials, tokens, keys, DB URIs or internal configuration. Blocking these
// protects the system even if a conversation is manipulated (Phase 22).
const OUTPUT_SECRET = [
  /\b(api[_-]?key|api[_-]?secret|access[_-]?token)\b/i,
  /\bOPENAI_API_KEY\b/i,
  /\bsk-[A-Za-z0-9_-]{10,}\b/i,
  /\bmongodb(\+srv)?:\/\/[^\s]+/i,
  /\b(password|passwd|pwd)\b/i,
  /\b(mongodb|database url)\b/i,
  /\btoken\b/i,
  /\b(secret)\b/i,
];

/**
 * Extract the numeric value from a currency figure sentence fragment so it can
 * be compared against retrieved (allowlisted) prices. Handles thousands
 * separators in the fr-FR grouped rendering (e.g. "3 200 DA" with a narrow
 * no-break space U+202F) — without this, any price >= 1000 parses as "3" and
 * is wrongly rejected as an invention (Phase 22 fix).
 */
function extractPriceValue(snippet: string): number | null {
  const m = snippet.match(/\d[\d.,\s\u202f\u00a0]*/);
  if (!m) return null;
  const n = Number(m[0].replace(/[.,\s\u202f\u00a0]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function priceAllowlisted(snippet: string, allowedFacts: string[]): boolean {
  const value = extractPriceValue(snippet);
  if (value === null) return false;
  return allowedFacts.some((f) => {
    const allowed = Number(String(f).replace(/[^\d.]/g, ""));
    return Number.isFinite(allowed) && allowed === value;
  });
}

/**
 * Optional authoritative facts the LLM output may reference. When omitted (or
 * empty), the stock/shipping/discount invention checks are not enforced — this
 * keeps the deterministic path (which already emits verified templates) and any
 * retrieval-less answer stable. The LLM path passes these so fabricated
 * availability/stock, shipping fees, and discounts are rejected.
 * 
 * When context is provided but empty (no products retrieved), we still want to
 * block fabricated claims. Use `hasRetrievalContext: false` to indicate no
 * products were found, which should trigger stricter checking.
 */
export interface OutputContext {
  /** Product titles that ARE in stock (positive availability claim allowed). */
  stockAvailable?: string[];
  /** Product titles that are OUT of stock (positive availability NOT allowed). */
  stockOut?: string[];
  /** Authoritative shipping fee values in DA (e.g. [600, 300]). */
  shippingPricesDA?: number[];
  /** Authoritative discount labels/values the output may repeat. */
  discounts?: string[];
  /** Whether retrieval was performed but found no products. */
  hasRetrievalContext?: boolean;
}

// Positive availability assertions (cross-language). "نفذت الكمية" / "Rupture
// de stock" describe unavailability and must NOT be treated as claims.
const STOCK_POSITIVE = [
  /(disponible|en\s*stock|en\s*stockage|available|in\s*stock|instock)\b/i,
  /(متوفر|متوفرة|متوفرين|موجود|موجودة|كاين|كاينة)/i,
  /(il\s*reste|reste\s+seulement).{0,20}\d/i,
];

const STOCK_POSITIVE_WORDS = [
  "disponible", "en stock", "available", "in stock",
  "متوفر", "متوفرة", "موجود", "موجودة", "كاين", "كاينة",
];

// A positive availability claim for a named product in ctx.stockOut is an
// invention; likewise any positive claim when nothing at all is in stock.
function checkStockInvention(
  proposed: string,
  ctx: OutputContext | undefined,
  violations: GuardResult["violations"]
): void {
  const lower = proposed.toLowerCase();

  for (const re of STOCK_POSITIVE) {
    if (!re.test(lower)) continue;
    const claimedWord = STOCK_POSITIVE_WORDS.find((w) => lower.includes(w));

    // First check: if retrieval was performed but found nothing, block positive claims
    if (ctx && ctx.hasRetrievalContext === false) {
      violations.push({ type: "stock_invention", snippet: claimedWord || proposed.match(re)?.[0] || "" });
      continue;
    }

    if (ctx) {
      const available = (ctx.stockAvailable || []).map((s) => s.toLowerCase());
      const out = (ctx.stockOut || []).map((s) => s.toLowerCase());
      const hasOut = out.length > 0;
      const namesToCheck = [...out, ...available];
      const namesPresent = namesToCheck.some((n) => n && lower.includes(n));

      if (namesPresent) {
        // Still reject if the named product is actually out of stock.
        const namedOut = out.some((n) => n && lower.includes(n));
        if (namedOut) {
          violations.push({ type: "stock_invention", snippet: proposed.match(re)?.[0] || "" });
        }
        return;
      }
      if (hasOut || available.length === 0) {
        // No authoritative in-stock item is named — a bare "available" claim is
        // unsupported. Flag when we have stock context to compare.
        if (ctx.stockAvailable !== undefined || ctx.stockOut !== undefined) {
          violations.push({ type: "stock_invention", snippet: claimedWord || proposed.match(re)?.[0] || "" });
        }
      }
      return;
    }
  }
}

// A shipping fee figure that is not among the retrieved fees is an invention.
// Note: \b (word boundary) does not work with Arabic characters in JavaScript regex.
// For Arabic terms, we use simple substring matching without word boundaries.
const SHIPPING_TERMS_FR = /\b(livraison|frais de livraison|port|shipping)\b/i;
const SHIPPING_TERMS_AR = /(التوصيل|الشحن|الطاكسي|الديليفري|livraison)/i;
const FREE_SHIPPING_TERMS_FR = /\b(gratuit|gratuite|offert|offerte|free)\b/i;
const FREE_SHIPPING_TERMS_AR = /(مجاني|مجانا|مجانية|مجانية|بلاش)/i;
function checkShippingInvention(
  proposed: string,
  ctx: OutputContext | undefined,
  violations: GuardResult["violations"]
): void {
  const lower = proposed.toLowerCase();
  const hasShippingTerm = SHIPPING_TERMS_FR.test(lower) || SHIPPING_TERMS_AR.test(lower);
  if (!hasShippingTerm) return;

  // Check for "free shipping" claims when authoritative shipping prices exist and are non-zero,
  // OR when retrieval was performed but no shipping data is available.
  const hasFreeShippingClaim = FREE_SHIPPING_TERMS_FR.test(lower) || FREE_SHIPPING_TERMS_AR.test(lower);
  if (hasFreeShippingClaim) {
    if (ctx && ctx.shippingPricesDA && ctx.shippingPricesDA.length > 0) {
      // Authoritative shipping prices exist - if any is non-zero, "free" is an invention
      const hasNonZeroPrice = ctx.shippingPricesDA.some((p) => p > 0);
      if (hasNonZeroPrice) {
        violations.push({ type: "shipping_invention", snippet: "free shipping claim" });
        return;
      }
    } else if (ctx && ctx.hasRetrievalContext === false) {
      // Retrieval performed but no shipping configured - "free" claim is invention
      violations.push({ type: "shipping_invention", snippet: "free shipping claim" });
      return;
    }
  }

  const numbers = proposed.match(/\d[\d,.]*/g) || [];
  for (const n of numbers) {
    const value = Number(n.replace(/[.,\s]/g, ""));

    if (ctx && ctx.shippingPricesDA && ctx.shippingPricesDA.length > 0) {
      // Has authoritative shipping prices - check against them
      if (Number.isFinite(value) && !ctx.shippingPricesDA.includes(value)) {
        const idx = proposed.indexOf(n);
        const snippet = proposed.slice(Math.max(0, idx - 20), idx + n.length + 6).trim();
        violations.push({ type: "shipping_invention", snippet });
        return;
      }
    } else if (ctx && ctx.hasRetrievalContext === false) {
      // Retrieval performed but no shipping configured - any numeric claim is invention
      if (Number.isFinite(value)) {
        const idx = proposed.indexOf(n);
        const snippet = proposed.slice(Math.max(0, idx - 20), idx + n.length + 6).trim();
        violations.push({ type: "shipping_invention", snippet });
        return;
      }
    }
    // If no context and no retrieval context, we can't verify - allow but log
  }
}

// A discount/promotion that is not among the retrieved discounts is invented.
// Note: \b (word boundary) does not work with Arabic characters in JavaScript regex.
// For Arabic terms, we use simple substring matching without word boundaries.
const DISCOUNT_TERMS = [
  /\b(réduction|reduction|remise|promo|promotion|rabais|soldes|discount)\b/i,
  /(خصم|تخفيض|تخفيضات|عرض|برومو|عروض خاصة|تخفيض في الثمن)/i,
];
function checkDiscountInvention(
  proposed: string,
  ctx: OutputContext | undefined,
  violations: GuardResult["violations"]
): void {
  const lower = proposed.toLowerCase();
  const hasDiscountTerm = DISCOUNT_TERMS.some((re) => re.test(lower));

  // If there's a discount term, or if we have retrieval context but no authoritative discounts,
  // check for percentage claims
  const shouldCheckPercentages = hasDiscountTerm || (ctx && ctx.hasRetrievalContext === false);

  if (ctx && ctx.discounts && ctx.discounts.length > 0) {
    // Has authoritative discounts - check against them
    const authoritative = ctx.discounts.map((d) => d.toLowerCase().replace(/[^0-9%]/g, ""));
    const numbers = proposed.match(/\d{1,3}([\.,]\d+)?\s*%/g) || [];
    for (const num of numbers) {
      if (!authoritative.includes(num.toLowerCase().replace(/\s/g, ""))) {
        violations.push({ type: "discount_invention", snippet: num.trim() });
        return;
      }
    }
  } else if (shouldCheckPercentages) {
    // No authoritative discounts but discount term present, or retrieval found no discounts
    // Any percentage claim is an invention
    const numbers = proposed.match(/\d{1,3}([\.,]\d+)?\s*%/g) || [];
    for (const num of numbers) {
      violations.push({ type: "discount_invention", snippet: num.trim() });
      return;
    }
  }
  // If no context and no retrieval context, we can't verify
}

/**
 * Validate a proposed response. Returns safe=false (and never passes it
 * through) when the response makes medical claims, guarantees results, asserts
 * a price that is not in the retrieved allowlist, or (when `context` is
 * provided) invents stock availability, shipping fees, or discounts.
 */
export function validateOutput(
  proposed: string,
  language: "ar" | "fr",
  allowedFacts: string[],
  context?: OutputContext
): GuardResult {
  const violations: GuardResult["violations"] = [];
  const snippet = (re: RegExp): string => {
    const m = proposed.match(re);
    return m ? m[0] : "";
  };

  for (const re of OUTPUT_MEDICAL) {
    if (re.test(proposed)) {
      violations.push({ type: "medical_claim", snippet: snippet(re) });
      break;
    }
  }
  // Avoid double-labelling a medical sentence as both medical and cure.
  for (const re of OUTPUT_CURE) {
    if (re.test(proposed)) {
      if (!violations.some((v) => v.type === "medical_claim")) {
        violations.push({ type: "cure_or_treatment", snippet: snippet(re) });
      }
      break;
    }
  }
  for (const re of OUTPUT_GUARANTEE) {
    if (re.test(proposed)) {
      violations.push({ type: "guarantee", snippet: snippet(re) });
      break;
    }
  }
  for (const re of OUTPUT_price) {
    if (re.test(proposed)) {
      const snip = snippet(re);
      // Allow a price only when it is one we retrieved.
      if (!priceAllowlisted(snip, allowedFacts)) {
        violations.push({ type: "price_invention", snippet: snip });
      }
      break;
    }
  }
  for (const re of OUTPUT_SECRET) {
    if (re.test(proposed)) {
      violations.push({ type: "prompt_injection", snippet: snippet(re) });
      break;
    }
  }

  checkStockInvention(proposed, context, violations);
  checkShippingInvention(proposed, context, violations);
  checkDiscountInvention(proposed, context, violations);

  // De-dup violation types.
  const unique = violations.filter(
    (v, i) => violations.findIndex((x) => x.type === v.type) === i
  );
  return { safe: unique.length === 0, violations: unique };
}

// -------------------------------
// Input guardrails — check the CUSTOMER message
// -------------------------------

const PROMPT_INJECTION = [
  /ignore.{0,30}(rules|instructions|system|policy|your rules|the rules)/i,
  /disregard.{0,30}(rules|instructions|instructions|policy)/i,
  /(jamais|ignore|oublie|forget|disregard|override|bypass).{0,30}(rules|consignes|instructions|policy|التعليمات|القواعد|القانون)/i,
  /(relevant au|ignore your)\b.{0,25}/i,
  /(قواعد|التعليمات|النظام|القانون)\b.*\b(تجاهل|انسى|لا تتبع)/i,
  /use this fake information/i,
  /(tell|say|respond with|reply)\b.{0,20}(fake|false|invented|invent)/i,
  // Fabrication directives (Phase 19AK / 19AA)
  /\b(tell the customer|say.*(guaranteed|in stocks?|free shipping|100%))\b/i,
  /(قل للعميل|قل للزبون|قل للمشتري|قل للعميل أن|أخبر العميل أن|اقنع العميل)/,
  /(قل إن|قل أن|قل لهم|اخترع|افترض شراء|افترض|ومن ثم قل)/,
  /(استخدم هذه المعلومات الكاذبة|هذه المعلومة كاذبة)/,
];

export function validateInputMessage(message: string): GuardResult {
  const violations: GuardResult["violations"] = [];
  const lower = message.toLowerCase();
  for (const re of PROMPT_INJECTION) {
    if (re.test(lower)) {
      violations.push({ type: "prompt_injection", snippet: message.slice(0, 60) });
      break;
    }
  }
  return { safe: violations.length === 0, violations };
}

/**
 * Determine whether a message looks like a medical/diagnosis question
 * (cross-language), which the AI must answer with a safe response rather than
 * a medical claim.
 */
export function isMedicalRiskQuestion(message: string): boolean {
  const lower = message.toLowerCase();
  const patterns = [
    // French: est-ce que ... (produit) ... (guérit|soigne|traite) ... diabète/cancer
    /(est-ce que|est ce que|ce produit|ce remède).{0,40}(guérit|guérir|soigne|soigner|traite|traiter|cure|cures?|heal|treats?).{0,35}(diabète|diabetes|cancer|hypertension|tension|maladie|disease|tumeur)/i,
    // English
    /(does|can|could|will|this product).{0,40}(cure|cures?|heal|treat|treats?).{0,35}(diabète|diabetes|cancer|hypertension|disease|tumor)/i,
    // Arabic / Darija
    /(يعالج|يشفي|يداوي|يشافي|يخلي|يعالج مرض|علاج).{0,25}(السكري|السرطان|الضغط|تقلاص|القلب|المرض)/i,
    /(يعالج السكري|يداوي السكري|يشفي السكري|واش يداوي السكري|هل يعالج)/i,
    /(هذا المنتج|هذا).{0,40}(يعالج|يشفي|يداوي).{0,20}(السكري|السرطان)/i,
  ];
  return patterns.some((p) => p.test(lower));
}
