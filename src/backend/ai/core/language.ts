/**
 * Phase 19I — Language Detection
 *
 * Supports Arabic, Algerian Darija, French, and mixed Arabic/French.
 * Returns a language code and, for mixed input, the dominant language.
 */
import { LanguageCode } from "./types";

const ARABIC_CHARS = /[\u0600-\u06FF\u0750-\u077F]/;
const LATIN_CHARS = /[a-zA-ZàâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ]/;

// Strong Darija indicators (distinctly Algerian vocabulary - not common Arabic)
const DARIJA_WORDS = new Set([
  // Distinctly Algerian pronouns/particles
  "خويا", "صاحبي", "رفيق", "ياخي", "ياختي", "علاش", "كيفاش", "فين", "وين",
  "غادي", "بغيت", "نحب", "كاين", "كاينة", "كاينين", "مليحة", "مليح", "زطاطة",
  "خليني", "نعاونك", "نخدمك", "نقولك", "تنصحني", "ننصح", "مزيان", "مزيانة",
  "مشكور", "ميرسي", "يا ريت", "يسعدك", "خير", "محتاج", "محتاجة", "نوصي", "نعطيك",
  "للرياضة", "للطاقة", "للصحة", "للدراسة", "للنوم", "للتركيز", "لمناعة", "للبشرة",
  "نشري", "نطلب", "ليفري", "ليفريج", "باريديموب", "باريدي", "باك", "باكات",
  "نفذت", "نفدت", "مفقود", "ناقص", "نفد", "انتهى", "خلص",
  "مزيان", "مزيانة", "لاباس", "لاباس عليك", "لاباس عليكوم",
  "شكرا بزاف", "مرسي", "ميرسي", "الله يعاون", "ربنا يعاون",
  "بخير", "ماشي", "ماشي مشكل", "ماشكلة", "تمام", "أهلا", "أهلاً",
  "سلام", "سلام عليكم", "عليكم السلام", "صباح الخير", "مساء الخير",
  "تصبح على خير", "طيب", "طيب جداً", "ممتاز", "ممتازة",
  "زين", "زينة", "حلو", "حلوة", "باهي", "باهية", "كويّس", "كويسة",
  "ماعندكش", "ماعندكمش", "ماعنديش", "ماغاديش", "مابغيتش", "ماحبش",
  "ماعرفش", "مافهمتش", "ماشي مشكل", "ماشكلة", "فهمت", "فهمتك", "فهمتكوم",
  "واضح", "مفهوم", "تمام", "تصبح على خير", "تصبح على خير",
  // Distinctly Algerian question words
  "شنو", "شن", "شنوة", "باش", "يلي", "حتى ما", "بلا ما",
]);

const FRENCH_WORDS = new Set([
  "bonjour", "salut", "merci", "oui", "non", "comment", "combien", "prix",
  "livraison", "paiement", "produit", "pack", "commande", "code", "wilaya",
  "disponible", "stock", "adresse", "téléphone", "telephone", "bureau",
  "domicile", "espèces", "espèces", "baridimob", "offre", "remise", "réduction",
  "reduction", "je", "veux", "voulais", "est", "moi", "nous", "vous", "avec",
  "sans", "pour", "dans", "sur", "une", "un", "le", "la", "les", "des", "du",
  "quel", "quelle", "quelles", "quels", "information", "conseil", "aidez",
  "aider", "parler", "quelqu", "aide", "urgent", "problème", "probleme",
  "colis", "suivre", "suivi", "livrer", "payé", "paye", "date", "onglet",
  "facebook", "instagram", "ding", "roi", "café", "cafe", "thé", "the", "sucre",
  "gingembre", "corde", "conseils", "maman", "cod", "honoraire",
]);

/**
 * Normalize Arabic word for Darija detection (strip punctuation, diacritics).
 */
function normalizeArabicWord(w: string): string {
  return w
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670]/g, "") // Arabic diacritics
    .replace(/[؟?!,.،;:()\[\]'"\-_]/g, "") // punctuation
    .trim();
}

/**
 * Detect the dominant language of a message.
 * @param message raw customer message
 * @param previousLanguage the language used in the preceding exchange, used as
 *   a tiebreak when Arabic/Latin detection is ambiguous (per Phase 19I: when
 *   uncertain, prefer the customer's latest language).
 */
export function detectLanguage(
  message: string,
  previousLanguage?: LanguageCode
): LanguageCode {
  const m = (message || "").trim();
  if (!m) return previousLanguage || "ar";

  const words = m.split(/\s+/).filter(Boolean);
  let arabicCount = 0;
  let darijaCount = 0;
  let latinCount = 0;

  for (const w of words) {
    const lower = w.toLowerCase().replace(/[^a-zàâäéèêëîïôöùûüç]/g, "");
    if (ARABIC_CHARS.test(w)) {
      const norm = normalizeArabicWord(w);
      if (DARIJA_WORDS.has(norm)) {
        darijaCount++;
      } else {
        arabicCount++;
      }
    } else if (LATIN_CHARS.test(w)) {
      if (FRENCH_WORDS.has(lower)) latinCount++;
      else latinCount++;
    }
  }

  // If ANY Darija-specific word is present, classify as Darija
  // (Darija is a variant of Arabic with distinct vocabulary markers)
  if (darijaCount > 0) return "darija";
  if (arabicCount > latinCount) return "ar";
  if (latinCount > arabicCount) return "fr";
  // Tied or empty of letters — fall back to the conversation's prior language.
  return previousLanguage || "ar";
}

/**
 * Strongly French heuristic for short Latin inputs without Arabic chars.
 */
export function containsLatinText(message: string): boolean {
  return LATIN_CHARS.test(message);
}
