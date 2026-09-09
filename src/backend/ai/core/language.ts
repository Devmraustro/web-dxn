/**
 * Phase 19I — Language Detection
 *
 * Supports Arabic, Algerian Darija, French, and mixed Arabic/French.
 * Returns a language code and, for mixed input, the dominant language.
 */
import { LanguageCode } from "./types";

const ARABIC_CHARS = /[\u0600-\u06FF\u0750-\u077F]/;
const LATIN_CHARS = /[a-zA-ZàâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ]/;

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
  let latinCount = 0;

  for (const w of words) {
    if (ARABIC_CHARS.test(w)) arabicCount++;
    else if (LATIN_CHARS.test(w)) {
      const lower = w.toLowerCase().replace(/[^a-zàâäéèêëîïôöùûüç]/g, "");
      if (FRENCH_WORDS.has(lower)) latinCount++;
      else latinCount++;
    }
  }

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
