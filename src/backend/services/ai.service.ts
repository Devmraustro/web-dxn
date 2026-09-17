import { AIKnowledge } from "../../Database/Models";
import { sendTelegramMessage, isTelegramConfigured } from "./telegram.service";

/**
 * AI Customer Support / Sales Assistant
 *
 * This service handles customer inquiries on Instagram and Facebook.
 * It uses a controlled knowledge base instead of relying on model memory
 * to prevent hallucination of product information, prices, availability, etc.
 */

interface AIResponse {
  answer: string;
  confidence: number; // 0-100
  needsHumanHandoff: boolean;
  escalationReason?: string;
}

// ReDoS hardening: cap input length and escape regex metacharacters before
// using customer input as a regex source. Without this an attacker can craft
// input like "(a+)+$" to cause catastrophic backtracking or break the query.
const MAX_QUERY_LEN = 64;
import { escapeRegex } from "../../utils/regex";
export { escapeRegex };

/**
 * Process a customer message and generate an AI response
 */
export const processCustomerMessage = async (
  message: string,
  platform: "instagram" | "facebook",
  userLanguage: "ar" | "fr",
  customerId?: string
): Promise<AIResponse> => {
  const cleanedMessage = message.trim().substring(0, 500);

  // 1. First, check the controlled knowledge base
  // Only the first MAX_QUERY_LEN chars are used; the rest is irrelevant for
  // exact-match KB lookup. The substring is regex-escaped so user-controlled
  // characters cannot be interpreted as regex syntax.
  const kbQuery = escapeRegex(cleanedMessage.substring(0, MAX_QUERY_LEN));
  const knowledgeEntry = await AIKnowledge.findOne({
    $or: [
      { question: new RegExp(kbQuery, "i") },
      { answer: new RegExp(kbQuery, "i") },
    ],
    language: userLanguage,
    isActive: true,
  }).lean();

  // 2. If found in knowledge base, use that answer
  if (knowledgeEntry) {
    return {
      answer: knowledgeEntry.answer,
      confidence: 95,
      needsHumanHandoff: false,
    };
  }

  // 3. If not found, generate response based on available product info
  // (This would integrate with the product database in a real implementation)
  
  // 4. Check for medical/safety claims - these must be rejected
  const medicalPatterns = [
    /(guarant|ensure|ensure.*weight|ensure.*diabetes|cure|heal|treating|therapy.*diabetes)/i,
    /(this product.*diabetes|this product.*cure|this product.*weight loss|miracle)/i,
  ];

  for (const pattern of medicalPatterns) {
    if (pattern.test(cleanedMessage)) {
      return {
        answer: userLanguage === "ar" 
          ? "هذا المنتج لا يشفي الأمراض ولا يضمن النتائج. يرجى استشارة مختص صحي." 
          : "This product does not cure diseases or guarantee results. Please consult a healthcare professional.",
        confidence: 0,
        needsHumanHandoff: true,
        escalationReason: "medical claim detected",
      };
    }
  }

  // 5. Check for product availability questions
  const availabilityPatterns = /(available|stock|in stock|out of stock)/i;
  if (availabilityPatterns.test(cleanedMessage)) {
    // In a real implementation, we would check the actual product stock
    return {
      answer: userLanguage === "ar"
        ? "لا أمتلك معلومات حالية عن توافر المنتج. يرجى التواصل مع owner للتأكد من التوافر."
        : "I don't have current information about product availability. Please contact the owner to verify stock.",
      confidence: 70,
      needsHumanHandoff: false,
    };
  }

  // 6. Check for price questions
  const pricePatterns = /(price|cost|combien|price|دينار)/i;
  if (pricePatterns.test(cleanedMessage)) {
    return {
      answer: userLanguage === "ar"
        ? "يمكنك العثور على أسعار المنتجات في صفحة كل منتج. أسعار الشحن محددة من قبل owner."
        : "You can find product prices on each product page. Shipping prices are set by the owner.",
      confidence: 85,
      needsHumanHandoff: false,
    };
  }

  // 7. Check for Pack questions
  const packPatterns = /(pack|sel|g|l) ?(sport|study|étude|essai)/i;
  if (packPatterns.test(cleanedMessage)) {
    return {
      answer: userLanguage === "ar"
        ? "يمكنك الاطلاع علىpacks المتاحة في المتجر. chaque pack offers des produits complémentaires pour un objectif spécifique."
        : "You can view available packs in the store. Each pack offers complementary products for a specific goal.",
      confidence: 80,
      needsHumanHandoff: false,
    };
  }

  // 8. Check for shipping questions
  const shippingPatterns = /(shipping|delivery|livraison|shipp|wilage|wilaya|commune)/i;
  if (shippingPatterns.test(cleanedMessage)) {
    return {
      answer: userLanguage === "ar"
        ? "التوصيل متاح لجميع ولايات الجزائر. التوصيل للمنزل يتطلب الولاية والبلدية والعنوان الكامل. للتوصيل لمكتب البريد، سيتم الاتصال بك."
        : "Shipping is available to all Algerian wilayas. Home delivery requires wilaya, commune, and full address. For office delivery, the owner will contact you.",
      confidence: 90,
      needsHumanHandoff: false,
    };
  }

  // 9. Check for payment questions
  const paymentPatterns = /(payment|paiement|cod|baridimob|cash|espèces)/i;
  if (paymentPatterns.test(cleanedMessage)) {
    return {
      answer: userLanguage === "ar"
        ? "طرق الدفع المتاحة: الدفع عند الاستلام فقط (كاش عند التسليم)."
        : "Available payment method: Cash on Delivery only (cash when you receive the order).",
      confidence: 92,
      needsHumanHandoff: false,
    };
  }

  // 10. Default: information not available - escalate to human
  return {
    answer: userLanguage === "ar"
      ? "لا أمتلك المعلومات الكافية للإجابة على سؤالك. سيتم نقل المحادثة إلى owner."
      : "I don't have sufficient information to answer your question. The conversation will be escalated to the owner.",
    confidence: 0,
    needsHumanHandoff: true,
    escalationReason: "uncertain product question",
  };
};

/**
 * Escalate a conversation to the owner via Telegram.
 *
 * Phase 22 (observability): the log is deliberately privacy-minimized — the
 * customer identifier is masked and the raw message is never logged verbatim
 * (only a short, safe rationale is recorded). Never log the full message or
 * any related API key/token.
 *
 * Telegram delivery: if TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are configured
 * the owner receives a real Telegram notification. If they are not configured
 * the call is a safe no-op (logs an info line) so the customer is never blocked.
 */
export const escalateToOwner = async (
  customerId: string,
  platform: "instagram" | "facebook",
  _message: string,
  reason: string
): Promise<{ delivered: boolean; configured: boolean }> => {
  const masked = maskIdentifier(customerId);
  const summary = `ESCALATION: ${masked} on ${platform} - ${reason}`;

  if (!isTelegramConfigured()) {
    console.log(`${summary} (Telegram not configured - no notification sent)`);
    return { delivered: false, configured: false };
  }

  try {
    const text = [
      "DXN AI Escalation",
      `Customer: ${masked}`,
      `Platform: ${platform}`,
      `Reason: ${reason}`,
    ].join("\n");
    const result = await sendTelegramMessage(text);
    console.log(`${summary} - delivered=${result.ok}`);
    return { delivered: result.ok, configured: true };
  } catch (err) {
    console.error(`${summary} - Telegram delivery FAILED`, err instanceof Error ? err.message : "unknown");
    return { delivered: false, configured: true };
  }
};

/**
 * Mask a customer identifier for logs to avoid persisting full PSID/phone
 * numbers (privacy minimization). Never logs the full identifier.
 */
function maskIdentifier(id: string): string {
  if (!id) return "unknown";
  if (id.length <= 4) return "*".repeat(id.length);
  return `${id.slice(0, 2)}***${id.slice(-2)}`;
}

/**
 * AI Safety guard - check if a message contains prohibited content
 */
export const safetyGuard = (message: string): { safe: boolean; violationType?: string } => {
  const cleaned = message.trim();
  
  // Medical claims - absolutely prohibited
  const medicalClaims = [
    /(guarant|ensure|cure|heal|treating)/i,
    /(this product.*diabetes|this product.*cure|this product.*weight loss)/i,
    /(miracle|magic.*solution|guaranteed.*result)/i,
  ];
  
  for (const pattern of medicalClaims) {
    if (pattern.test(cleaned)) {
      return { safe: false, violationType: "medical_claim" };
    }
  }
  
  // Price invention
  const priceInvention = /(this product costs|this product is|price is)\s*\d+/.test(cleaned);
  
  // Inventory invention
  const inventoryInvention = /(there are|there's)\s+\d+/.test(cleaned);
  
  if (priceInvention) {
    return { safe: false, violationType: "price_invention" };
  }
  
  if (inventoryInvention) {
    return { safe: false, violationType: "inventory_invention" };
  }
  
  return { safe: true };
};

export default {
  processCustomerMessage,
  escalateToOwner,
  safetyGuard,
};