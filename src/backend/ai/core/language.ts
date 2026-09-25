/**
 * Phase 19I — Language Detection
 *
 * Supports Arabic, Algerian Darija, French, and mixed Arabic/French.
 * Returns a language code and, for mixed input, the dominant language.
 */
import { LanguageCode } from "./types";

const ARABIC_CHARS = /[\u0600-\u06FF\u0750-\u077F]/;
const LATIN_CHARS = /[a-zA-ZàâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ]/;

// Strong Darija indicators (Arabic script but distinct vocabulary)
const DARIJA_WORDS = new Set([
  "كاين", "كاينة", "كاينين", "واش", "واش كاين", " شنو", "شنو", "بشحال", "شحال", "كيفاش", "فين", "وين",
  "غادي", "بغيت", "نحب", "عندك", "عندكم", "معي", "معلومة", "علاش", "أسباب", "مهم", "زطاطة",
  "خوا", "خليني", "خليني نشوف", "نعاونك", "نخدمك", "نقولك", "نصح", "تنصحني", "ننصح",
  "مزيان", "مزيانة", "على فكرة", "بالمقابل", "مشكور", "ميرسي", "يا ريت", "يسعدك",
  "خير", "محتاج", "محتاجة", "نوصي", "نعطيك", "تفاصيل", "معلومة", "معلومات",
  "للرياضة", "للطاقة", "للصحة", "للدراسة", "للنوم", "للتركيز", "لمناعة", "للبشرة",
  "الاستعمال اليومي", "يومي", "مباشرة", "نضيف", "نكمل", "نشري", "نطلب",
  "التوصيل", "الشحن", "ليفري", "ليفريج", "يدفع", "الاستلام", "باريديموب", "باريدي",
  "كاش", "نقدا", "المنتج", "الباك", "العلبة", "السلة", "المجموعة", "الحزمة",
  "العرض", "العروض", "التخفيض", "التخفيضات", "برومو", "خصم", "موجود", "موجودة",
  "نفذت", "نفدت", "الكمية", "مخزون", "كاين عندكم", "عندكم", "عندك", "طيب",
  "واحش", "نصف", "قريب", "إيلي", "دير", "ديرلي", "علمني", "عرفني", "قالولي"
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
      if (DARIJA_WORDS.has(lower)) {
        darijaCount++;
      } else {
        arabicCount++;
      }
    } else if (LATIN_CHARS.test(w)) {
      if (FRENCH_WORDS.has(lower)) latinCount++;
      else latinCount++;
    }
  }

  // Darija wins if it has the most Darija-specific words
  if (darijaCount > arabicCount && darijaCount > latinCount) return "darija";
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
