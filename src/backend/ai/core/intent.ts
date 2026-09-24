/**
 * Phase 19F — Intent System
 *
 * Rule-based intent classifier that works across Arabic, Algerian Darija and
 * French. Extensible: add patterns to a category to grow coverage. The intent
 * drives which retrieval strategy the orchestrator uses.
 */
import { Intent, IntentResult, LanguageCode } from "./types";
import { detectLanguage, containsLatinText } from "./language";

interface PatternGroup {
  intent: Intent;
  patterns: RegExp[];
}

// Arabic / Darija word roots (partial Latinization handled too).
const AR: Record<string, string[]> = {
  price: ["شحال", "بشحال", "الثمن", "السمة", "سوم", "سومة", "كم سعر", "سعر"],
  shipping: ["توصيل", "ليفراج", "ليفري", "يعمر", "الولاية", "دعم", "الشحن", "التخليص"],
  payment: ["دفع", "الدفع", "ادفع", "باريدي", "باريديموب", "كاش", "الاستلام", "بكاش", "نقدا"],
  product: ["المنتج", "المواصفات", "معدة", "معلومات", "ما هو", "شنو", "وصف"],
  availability: ["متوفر", "موجود", "الكمية", "مخزون", "نفذت", "كاين"],
  human: ["شخص", "نسو", "تواصل", "كلمني", "هدر", "حقا", "مساعدة"],
  greeting: ["سلام", "مرحبا", "اهلا", "اهلان", "صباح", "مساء", "بونجور"],
  complaint: ["شكوى", "مشكل", "غاضب", "خطا", "متضرر", "وصلنيش", "وصلانيش", "ماوصلش", "ما وصلش"],
  order: ["طلب", "الطلب", "أمر", "الأمر", "تتبع", "متابعة", "وين الطلب"],
  pack: ["باك", "علبة", "سلة", "مجموعة", "حزمة"],
  offer: ["عرض", "عروض", "العروض", "تخفيض", "التخفيضات", "برومو", "خصم"],
  thanks: ["شكرا", "ميرسي", "يعيشك", "بارك الله"],
  recommend: ["انصح", "نصيحة", "اقترح", "ترشيح", "مناسب ل", "حاجة ل", "وش من", "شن غادي", "تنصحني", "ننصح", "تنصح", "نصحت"],
  catalog: ["المنتجات", "كاين شنو", "واش عندكم", "المعروض", "قائمة", "كل المنتجات"],
};

// Arabic / Darija product-category keywords, mapped via catalog metadata.
export const ARABIC_CATEGORY_TERMS: Record<string, string[]> = {
  coffee: ["قهوة", "القهوة", "الكافا", "قهاوي"],
  tea: ["شاي", "الشاي", "أتي"],
  ginger: ["زنجبيل", "أنجابة", "gngb"],
  spirulina: ["سبيرولينا", "سبيرولين"],
  cordyceps: ["كورديسيبس", "طاقة"],
  lingzhi: ["لينجزي", "ريشي"],
};

/**
 * Classify the intent of a customer message.
 */
export function classifyIntent(
  message: string,
  previousLanguage?: LanguageCode
): IntentResult {
  const m = (message || "").trim();
  const language = detectLanguage(m, previousLanguage);

  const entities: IntentResult["entities"] = {
    product: extractProductEntity(m),
    pack: extractPackEntity(m),
    category: extractCategoryEntity(m),
    wilaya: extractWilayaEntity(m),
    orderNumber: extractOrderNumber(m),
  };

  // Human-request and complaint intents are highest priority.
  if (matches(HUMAN_PATTERNS, m) || matchArabic(m, AR.human)) {
    return ok(Intent.HUMAN_REQUEST, 1.0, language, entities);
  }
  if (matches(COMPLAINT_PATTERNS, m) || matchArabic(m, AR.complaint)) {
    return ok(Intent.COMPLAINT, 1.0, language, entities);
  }

  // Order number present => order status (specific before generic order).
  if (entities.orderNumber) {
    return ok(Intent.ORDER_STATUS, 0.95, language, entities);
  }
  if (matches(ORDER_PATTERNS, m) || matchArabic(m, AR.order)) {
    return ok(Intent.ORDER_HELP, 0.85, language, entities);
  }

  // Business intents take precedence over social greetings (Phase 5 F-1): a
  // message like "مرحبا، بشحال القهوة؟" is answered with the business answer
  // and the greeting becomes a modifier, so only a PURE greeting message is
  // answered with the social template.
  if (matches(PACK_PATTERNS, m) || matchArabic(m, AR.pack)) {
    return ok(Intent.PACK_INFO, 0.9, language, entities);
  }

  if (matches(PRICE_PATTERNS, m) || matchArabic(m, AR.price)) {
    return ok(Intent.PRODUCT_PRICE, 0.85, language, entities);
  }
  // Shipping terms are a stronger signal than the generic Darija "كاين"
  // (there is) which is shared with availability questions.
  if (matches(SHIPPING_PATTERNS, m) || matchArabic(m, AR.shipping)) {
    return ok(Intent.SHIPPING, 0.85, language, entities);
  }
  // Offers / payment / catalog are checked BEFORE availability so the Darija
  // "كاين" wording never hijacks an offer question (Phase 5 F-2).
  if (matches(OFFER_PATTERNS, m) || matchArabic(m, AR.offer)) {
    return ok(Intent.OFFER_INFO, 0.7, language, entities);
  }
  if (matches(PAYMENT_PATTERNS, m) || matchArabic(m, AR.payment)) {
    return ok(Intent.PAYMENT, 0.85, language, entities);
  }
  if (matches(CATALOG_PATTERNS, m) || matchArabic(m, AR.catalog)) {
    return ok(Intent.CATALOG, 0.7, language, entities);
  }

  // Availability requires a product / category / pack entity — OR a Latin
  // product-like token (a slug / alias such as "unknown-stock") that the data
  // layer can resolve. A bare "واش كاين؟"/"متوفر?"/'"disponible?"' with no
  // specific reference is catalog-browsing (Phase 5 F-2).
  if (matches(AVAILABILITY_PATTERNS, m) || matchArabic(m, AR.availability)) {
    if (entities.product || entities.category || entities.pack || hasProductishToken(m)) {
      return ok(Intent.PRODUCT_AVAILABILITY, 0.9, language, entities);
    }
    return ok(Intent.CATALOG, 0.7, language, entities);
  }
  if (matches(RECOMMEND_PATTERNS, m) || matchArabic(m, AR.recommend)) {
    return ok(Intent.PRODUCT_RECOMMENDATION, 0.8, language, entities);
  }

  // Social intents are a last resort.
  if (matches(GREETING_PATTERNS, m) || matchArabic(m, AR.greeting)) {
    return ok(Intent.GREETING, 1.0, language, entities);
  }
  if (matches(THANKS_PATTERNS, m) || matchArabic(m, AR.thanks)) {
    return ok(Intent.THANKS, 1.0, language, entities);
  }

  if (entities.product || entities.pack || entities.category) {
    return ok(Intent.PRODUCT_INFO, 0.6, language, entities);
  }
  if (matches(PRODUCT_PATTERNS, m) || matchArabic(m, AR.product)) {
    return ok(Intent.PRODUCT_INFO, 0.55, language, entities);
  }

  return ok(Intent.UNKNOWN, 0.2, language, entities);
}

/**
 * True when a message opens with a greeting word/phrase. Used by the
 * orchestrator to acknowledge the greeting while still answering the actual
 * business question (Phase 5 F-1).
 */
export function containsGreeting(message: string): boolean {
  const m = (message || "").trim();
  return matches(GREETING_PATTERNS, m) || matchArabic(m, AR.greeting);
}

function ok(
  intent: Intent,
  confidence: number,
  language: LanguageCode,
  entities: IntentResult["entities"]
): IntentResult {
  return { intent, confidence, language, entities };
}

function matchArabic(message: string, terms: string[]): boolean {
  const lower = message.toLowerCase();
  // Strip Arabic diacritics for matching robustness.
  const normalized = lower.replace(/[\u064B-\u0652\u0670]/g, "");
  return terms.some((t) => normalized.includes(t));
}

function matches(patternList: RegExp[], message: string): boolean {
  const lower = message.toLowerCase();
  return patternList.some((p) => p.test(lower));
}

const HUMAN_PATTERNS = [
  /(parler.{0,20}(humain|quelqu'un|une personne|propriétaire|owner))/i,
  /(aider|aide-moi).{0,20}(humain|personne|propriétaire)/i,
  /(i want to speak|talk to a human|contact.*person)/i,
  /(تجري|تواصل|نسو|نهدر مع شخص|هدر مع واحدة|بلا بوت|بلا روبوت)/i,
];
const COMPLAINT_PATTERNS = [
  /\b(complaint|problem|issue|angry|wrong order|scam|arnaque)\b/i,
  /(شكوى|مشكل|غاضب|خطأ|خطا|متضرر|ما وصلنيش|ما وصلانيش|ماوصلنيش|ماوصلش|ما وصلش|ما وصلكش|وصلنيش)/i,
];
const GREETING_PATTERNS = [
  /^(bonjour|salut|salam|hi|hello|hey|slm)\b/i,
  /(مرحبا|اهلا|سلام|صباح الخير|مساء الخير|بونجور)/i,
];
const THANKS_PATTERNS = [
  /\b(merci|thanks|thank you|shukran)\b/i,
  /(شكرا|شكراً|ميرسي|يعيشك|بارك الله)/i,
];
const PRICE_PATTERNS = [
  /\b(price|cost|combien|how much|prix|tarif)\b/i,
  /combien\s+(ça|ca)?\s*co(u|û)te/i,
  /(سعر|الثمن|شحال|بشحال|كم سعر|سوم)/i,
];
const AVAILABILITY_PATTERNS = [
  /\b(available|availability|in stock|out of stock|stock)\b/i,
  /(متوفر|متوفرة|موجود|مخزون|الكمية|نفذت)/i,
];
const PACK_PATTERNS = [
  /\b(pack)\b/i,
  /(باك|علبة|مجموعة)/i,
];
const SHIPPING_PATTERNS = [
  /\b(shipping|delivery|livraison|expédition|available to)\b/i,
  /(كيف ناخذ التوصيل|واش التوصيل|توصيل|الشحن|ليفراج|يعمر|الولاية|اين توصلون)/i,
];
const PAYMENT_PATTERNS = [
  /\b(payment|pay|paiement|payer|cod|cash on delivery|baridimob|espèces)\b/i,
  /(الدفع|دفع|ادفع|باريديموب|كاش|بكاش|عند الاستلام|نقدا)/i,
];
const ORDER_PATTERNS = [
  /\b(order|commande|status|suivi|suivre)\b/i,
  /(الطلب|أين طلبي|وين الطلب|تتبع|متابعة|حالة الطلب)/i,
];
const PRODUCT_PATTERNS = [
  /\b(product|produit|article|what is)\b/i,
  /(المنتج|المواصفات|وصف المنتج|معلومات|ما هو)/i,
];
const RECOMMEND_PATTERNS = [
  /\b(recommend|recommendation|suggest|suitable for|advise)\b/i,
  /(انصح|نصيحة|اقترح|مناسب|حاجة ل|وش من|شن غادي|خير|تنصحني|ننصح|تنصح|نصحت)/i,
];
const OFFER_PATTERNS = [
  /\b(offer|discount|promo|promotion|reduction|deal)\b/i,
  /(عرض|عروض|العروض|تخفيض|تخفيضات|برومو|خصم)/i,
];
const CATALOG_PATTERNS = [
  /\b(catalog|products|all products|list|menu)\b/i,
  /(المنتجات|كاين شنو|واش عندكم|المعروض|القائمة|كل المنتجات)/i,
];

// Known product identifiers (slugs / aliases / seed titles) used to decide
// whether a message names a specific product. Only real identifiers qualify —
// generic words never become a product entity, so a bare "واش كاين؟" stays
// entity-less (→ catalog browsing) instead of an availability question.
const PRODUCT_ENTITY_TERMS: string[] = [
  "lingzhi-coffee-3in1", "lingzhi-coffee", "black-coffee", "spirulina",
  "reishi-gano", "ganocelium", "cordyceps", "morinzhi", "spiruline",
  "gaintegra", "andrographis", "dionic", "royal morin",
  "قهوة الريشي 3 في 1", "قهوة الريشي", "القهوة السوداء", "سبيرولينا",
  "ريشي غانو", "غانوسيليوم", "كورديسيبس", "مورينزي",
  "ganozhi", "gano", "lingzhi", "reishi", "morinzhi", "cordyceps", "ganocelium",
  "coffee", "قهوة", "سبيرولين",
];

function extractProductEntity(message: string): string | undefined {
  const lower = message.toLowerCase();
  for (const term of PRODUCT_ENTITY_TERMS) {
    if (lower.includes(term)) return term;
  }
  return undefined;
}

// Concept / glue words that never signal a specific product. A message whose
// only Latin words are these (e.g. "disponible?", "in stock?") is a bare
// availability question → catalog browsing, not a named-product lookup.
const NON_PRODUCT_LATIN_WORDS = new Set([
  "disponible", "available", "availability", "stock", "in", "out", "of", "off",
  "en", "de", "du", "des", "un", "une", "le", "la", "les", "the", "est", "et",
  "many", "beaucoup", "combien", "coute", "coûte", "ça", "ca", "il", "y", "a",
]);

function hasProductishToken(message: string): boolean {
  const words = message.toLowerCase().match(/[a-zà-ÿ]{2,}(?:-[a-zà-ÿ0-9]+)*/g) || [];
  return words.some(
    (w) => (w.length >= 3 || w.includes("-")) && !NON_PRODUCT_LATIN_WORDS.has(w)
  );
}

function extractPackEntity(message: string): string | undefined {
  const m = message.match(/\bpack\s+([a-zà-ÿ0-9_-]+)/i);
  if (m && m[1] && m[1].length >= 3) {
    return m[1].toLowerCase();
  }
  // Generic pack wording ("الباكات", "packs", a bare "pack" with no name)
  // yields no entity so the orchestrator lists the pack catalog instead of
  // scoping to a wrong pack.
  const ar = message.match(/(?:باك|علبة)\s*[:\s]*([\u0600-\u06FFa-zA-Z0-9_-]{3,})/);
  return ar ? ar[1].toLowerCase() : undefined;
}

function extractCategoryEntity(message: string): string | undefined {
  const lower = containsLatinText(message) ? message.toLowerCase() : message;
  const categories: Record<string, string[]> = {
    coffee: ["coffee", "café", "cafe", "قهوة", "كافا"],
    tea: ["tea", "thé", "the", "شاي"],
    ginger: ["ginger", "gingembre", "زنجبيل"],
    spirulina: ["spiruline", "spirulina", "سبيرولينا"],
  };
  for (const [cat, terms] of Object.entries(categories)) {
    if (terms.some((t) => lower.includes(t))) return cat;
  }
  return undefined;
}

function extractWilayaEntity(message: string): string | undefined {
  const known: string[] = [
    "adrar", "chlef", "laghouat", "oum el bouaghi", "batna", "bejaia", "biskra",
    "bechar", "blida", "bouira", "tamanrasset", "tebessa", "tlemcen", "tiaret",
    "tizi ouzou", "alger", "djelfa", "jijel", "setif", "saida", "skikda",
    "sidi bel abbes", "annaba", "guelma", "constantine", "medea", "mostaganem",
    "msila", "mascara", "ouargla", "oran", "el bayadh", "illizi", "bordj bou arreridj",
    "boumerdes", "el tarf", "tindouf", "tissemsilt", "el oued", "khenchela",
    "souk ahras", "tipaza", "mila", "ain defla", "naama", "ain temouchent",
    "ghardaia", "relizane",
    "سطيف", "برج بوعريريج", "الجزائر", "وهران", "البليدة",
    "قسنطينة", "عنابة", "جيجل", "بجاية", "تيزي وزو", "تلمسان", "باتنة",
    "بسكرة", "سكيكدة", "قالمة", "معسكر", "غرداية", "ورقلة", "سيدي بلعباس",
    "أم البواقي", "البيض", "تندوف", "تقرت", "إليزي", "عين الدفلى", "عين تموشنت",
    "الوادي", "خنشلة", "سوق أهراس", "تيبازة", "ميلة", "المسيلة", "المدية",
    "مستغانم", "النعامة", "تسمسيلت", "أدرار", "الشلف", "الأغواط", "أم البواقي",
    "الطارف", "تيميمون", "بني عباس", "إن صالح", "إن قزام", "تقرت",
  ];
  const lower = message.toLowerCase();
  for (const w of known) {
    if (lower.includes(w)) return w;
  }
  return undefined;
}

function extractOrderNumber(message: string): string | undefined {
  // Format: DXN-YYYY-12345
  const m = message.match(/DXN[-_ ]?\d{4}[-_ ]?\d{3,6}/i);
  return m ? m[0].toUpperCase() : undefined;
}
