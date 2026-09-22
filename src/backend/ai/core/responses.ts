/**
 * Phase 19J/19D — Response Templates
 *
 * Build concise, friendly, professional responses from RETRIEVED data only.
 * Used by the deterministic path (no LLM), as a fallback when the LLM is
 * unavailable (Phase 19AC), and as a safe fallback when output validation
 * blocks an LLM response (Phase 19L).
 *
 * Personality: professional, friendly, Algerian, concise, non-annoying.
 */
import { CatalogItem, Intent, LanguageCode, ShippingInfo, StockState } from "./types";

const SAFE_MEDICAL = {
  ar: "منتجات DXN مكملات غذائية و ليست أدوية. لا يمكننا الإدلاء بمعلومات طبية عن الأمراض. للأسئلة الصحية، ننصحك بمراجعة مختص صحي. هل تريد معلومات عن المنتج، التوصيل أو الدفع؟",
  fr: "Les produits DXN sont des compléments alimentaires, pas des médicaments. Nous ne pouvons pas donner d'avis médical sur des maladies. Pour toute question de santé, nous vous conseillons de consulter un professionnel. Voulez-vous des informations sur un produit, la livraison ou le paiement ?",
};

const SAFE_FALLBACK = {
  ar: "عذرًا، لا أستطيع مساعدتك الآن في هذا الطلب. سأحولك إلى فريقنا وسيتواصلون معك قريبًا.",
  fr: "Désolé, je ne peux pas vous aider pour cette demande maintenant. Je vous transfère à notre équipe qui vous contactera rapidement.",
};

const ESCALATED = {
  ar: "سأمرر سؤالك إلى فريقنا، سيتواصل معك أحد المختصين قريبًا.",
  fr: "Je transmets votre demande à notre équipe, un membre vous contactera rapidement.",
};

const GREETING = {
  ar: "سلام! مرحبًا بك في متجر DXN 🟢 نحن في خدمتك. كيف نقدر نعاونك؟",
  fr: "Salam ! Bienvenue chez DXN 🟢 Nous sommes là pour vous aider. Comment pouvons-nous vous assister ?",
};

export function safeMedicalResponse(lang: LanguageCode): string {
  return SAFE_MEDICAL[lang];
}
export function safeFallbackResponse(lang: LanguageCode): string {
  return SAFE_FALLBACK[lang];
}
export function escalatedResponse(lang: LanguageCode): string {
  return ESCALATED[lang];
}
export function greetingResponse(lang: LanguageCode): string {
  return GREETING[lang];
}

function fmtDA(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} DA`;
}

function formatStock(state: StockState | undefined, lang: LanguageCode): string {
  switch (state) {
    case "IN_STOCK":
      return lang === "ar" ? "متوفر" : "En stock";
    case "OUT_OF_STOCK":
      return lang === "ar" ? "نفذت الكمية" : "Rupture de stock";
    case "UNKNOWN":
    default:
      return lang === "ar" ? "لا أستطيع تأكيد المخزون حاليًا" : "Je ne peux pas confirmer le stock pour le moment";
  }
}

function card(item: CatalogItem, lang: LanguageCode, link: boolean): string {
  const stockNote = item.stockState ? formatStock(item.stockState, lang) : (item.available ? (lang === "ar" ? "متوفر" : "En stock") : (lang === "ar" ? "نفذت الكمية" : "Rupture de stock"));
  const base = `${item.title} (${stockNote})`;
  const price = item.compareAtPriceDA && item.compareAtPriceDA > item.priceDA
    ? `${fmtDA(item.compareAtPriceDA)} → ${fmtDA(item.priceDA)}`
    : fmtDA(item.priceDA);
  const points = typeof item.points === "number" && item.points > 0
    ? (lang === "ar" ? ` | نقاط DXN: ${item.points}` : ` | Points DXN: ${item.points}`)
    : "";
  const url = link ? ` 🔗 ${item.storeUrl}` : "";
  return `• ${base} — ${price}${points}${url}`;
}

export function productInfoResponse(
  products: CatalogItem[],
  intent: Intent,
  lang: LanguageCode,
  withLink = true
): string | undefined {
  if (products.length === 0) return undefined;
  const lines = products.slice(0, 3).map((p) => card(p, lang, withLink));
  const title =
    intent === Intent.PRODUCT_PRICE
      ? lang === "ar" ? "الأسعار الحالية:" : "Prix actuels :"
      : intent === Intent.PRODUCT_AVAILABILITY
      ? lang === "ar" ? "التوفر:" : "Disponibilité :"
      : lang === "ar" ? "إليك المنتجات:" : "Voici les produits :";
  return `${title}\n${lines.join("\n")}`;
}

export function recommendationResponse(
  items: CatalogItem[],
  lang: LanguageCode,
  matchedTerms: string[]
): string {
  if (items.length === 0) {
    return lang === "ar"
      ? "شكرًا لسؤالك! اقترحك لنا منتجاتنا الحالية في المتجر:"
      : "Merci pour votre question ! Je vous propose nos produits actuels :";
  }
  const lines = items.slice(0, 3).map((p) => card(p, lang, true));
  return lang === "ar"
    ? `انطلاقًا من طلبك، هذه اقتراحاتنا المتوفرة:\n${lines.join("\n")}`
    : `Selon votre demande, voici nos suggestions disponibles :\n${lines.join("\n")}`;
}

export function shippingResponse(shipping: ShippingInfo | undefined, lang: LanguageCode): string {
  if (!shipping) {
    return lang === "ar"
      ? "التوصيل متوفر لكل الولايات عن طريق التوصيل المنزلي أو لمكتب البريد. للتأكيد، تواصل معنا مباشرة."
      : "La livraison est disponible pour toutes les wilayas en domicile ou en bureau de poste. Contactez-nous pour confirmation.";
  }
  const parts: string[] = [];
  if (shipping.wilaya) {
    parts.push(
      lang === "ar"
        ? `التوصيل إلى ${shipping.wilaya}:`
        : `Livraison vers ${shipping.wilaya} :`
    );
  }
  const lines: string[] = [];
  if (shipping.homeDelivery) {
    // Show price if explicitly configured (including 0 as valid configured value)
    // Only show "not configured" when shippingConfigured is explicitly false
    const homePrice = shipping.homePriceDA;
    if (homePrice !== undefined) {
      lines.push(
        lang === "ar"
          ? `• للمنزل: ${fmtDA(homePrice)}`
          : `• Domicile : ${fmtDA(homePrice)}`
      );
    } else if (shipping.shippingConfigured === false) {
      lines.push(
        lang === "ar"
          ? "• للمنزل: غير محدد (تواصل معنا للتأكيد)"
          : "• Domicile : non défini (contactez-nous pour confirmation)"
      );
    } else {
      lines.push(
        lang === "ar"
          ? "• للمنزل: حسب الولاية"
          : "• Domicile : selon wilaya"
      );
    }
  }
  if (shipping.officeDelivery) {
    const officePrice = shipping.officePriceDA;
    if (officePrice !== undefined) {
      lines.push(
        lang === "ar"
          ? `• لمكتب البريد: ${fmtDA(officePrice)}`
          : `• Bureau de poste : ${fmtDA(officePrice)}`
      );
    } else if (shipping.shippingConfigured === false) {
      lines.push(
        lang === "ar"
          ? "• لمكتب البريد: غير محدد (تواصل معنا للتأكيد)"
          : "• Bureau de poste : non défini (contactez-nous pour confirmation)"
      );
    } else {
      lines.push(
        lang === "ar"
          ? "• لمكتب البريد: حسب الولاية"
          : "• Bureau de poste : selon wilaya"
      );
    }
  }
  if (lines.length) parts.push(lines.join("\n"));
  // If no lines (no delivery methods or no prices), show generic message
  if (parts.length === (shipping.wilaya ? 1 : 0)) {
    return lang === "ar"
      ? "التوصيل متوفر، لكن الرسوم غير محددة حاليًا. تواصل معنا للتأكيد."
      : "La livraison est disponible, mais les frais ne sont pas définis pour le moment. Contactez-nous pour confirmation.";
  }
  return parts.join("\n");
}

export function offersResponse(offers: any[], lang: LanguageCode): string {
  if (!offers || offers.length === 0) {
    return lang === "ar"
      ? "لا توجد عروض حالية الآن، لكن تابعنا لأي جديد!"
      : "Aucune offre en ce moment, mais restez à l'écoute !";
  }
  const lines = offers.slice(0, 3).map((o) => {
    const label =
      o.label ||
      (o.type === "percentage"
        ? lang === "ar" ? `خصم ${o.value}%` : `-${o.value}%`
        : o.type === "fixed"
        ? lang === "ar" ? `خصم ${fmtDA(o.value)}` : `-${fmtDA(o.value)}`
        : o.title);
    return `• ${o.title} — ${label}`;
  });
  return lang === "ar"
    ? `العروض الحالية:\n${lines.join("\n")}`
    : `Offres actuelles :\n${lines.join("\n")}`;
}

export function paymentResponse(lang: LanguageCode): string {
  return lang === "ar"
    ? "طرق الدفع المتاحة: الدفع عند الاستلام فقط (كاش عند التسليم)."
    : "Moyens de paiement disponibles : paiement à la livraison uniquement (espèces à la réception).";
}

export function orderHelpResponse(lang: LanguageCode): string {
  return lang === "ar"
    ? "للاستفسار عن طلبك، شاركنا رقم الطلب (مثل DXN-2024-00001) أو تواصل معنا وسنساعدك."
    : "Pour toute question sur votre commande, partagez son numéro (ex : DXN-2024-00001) ou contactez-nous.";
}
