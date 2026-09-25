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
  darija: "منتجات DXN مكملات غذائية مش أدوية. ما نقدرش نعطيو معلومات طبية على الأمراض. للأسئلة الصحية، نصحوك تراجع مختص. تحب تعرف على المنتج، التوصيل ولا الدفع؟",
};

const SAFE_FALLBACK = {
  ar: "عذرًا، لا أستطيع مساعدتك الآن في هذا الطلب. سأحولك إلى فريقنا وسيتواصلون معك قريبًا.",
  fr: "Désolé, je ne peux pas vous aider pour cette demande maintenant. Je vous transfère à notre équipe qui vous contactera rapidement.",
  darija: "سمح لي، ما نقدرش نعاونك هاذ اللحظة. نحولك للفريق باش يتواصلو معاك.",
};

const ESCALATED = {
  ar: "سأمرر سؤالك إلى فريقنا، سيتواصل معك أحد المختصين قريبًا.",
  fr: "Je transmets votre demande à notre équipe, un membre vous contactera rapidement.",
  darija: "نمرر سؤالك للفريق، واحد من المختصين غادي يتواصل معاك قريبًا.",
};

const GREETING = {
  ar: "سلام! مرحبًا بك في متجر DXN 🟢 نحن في خدمتك. كيف نقدر نعاونك؟",
  fr: "Salam ! Bienvenue chez DXN 🟢 Nous sommes là pour vous aider. Comment pouvons-nous vous assister ?",
  darija: "سلام! مرحبًا بيك في متجر DXN 🟢 نحن في خدمتك. شنو نقدر نعاونك؟",
};

export function safeMedicalResponse(lang: LanguageCode): string {
  const isFr = lang === "fr";
  return SAFE_MEDICAL[isFr ? "fr" : "ar"];
}
export function safeFallbackResponse(lang: LanguageCode): string {
  const isFr = lang === "fr";
  return SAFE_FALLBACK[isFr ? "fr" : "ar"];
}
export function escalatedResponse(lang: LanguageCode): string {
  const isFr = lang === "fr";
  return ESCALATED[isFr ? "fr" : "ar"];
}
export function greetingResponse(lang: LanguageCode): string {
  const isFr = lang === "fr";
  return GREETING[isFr ? "fr" : "ar"];
}

function fmtDA(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} DA`;
}

function formatStock(state: StockState | undefined, lang: LanguageCode): string {
  switch (state) {
    case "IN_STOCK":
      return lang === "fr" ? "En stock" : "متوفر";
    case "OUT_OF_STOCK":
      return lang === "fr" ? "Rupture de stock" : "نفذت الكمية";
    case "UNKNOWN":
    default:
      return lang === "fr"
        ? "Je ne peux pas confirmer le stock pour le moment"
        : "لا أستطيع تأكيد المخزون حاليًا";
  }
}

function card(item: CatalogItem, lang: LanguageCode, link: boolean, showStock = true): string {
  const isFr = lang === "fr";
  const stockNote = showStock
    ? item.stockState ? formatStock(item.stockState, lang) : (item.available ? (isFr ? "En stock" : "متوفر") : (isFr ? "Rupture de stock" : "نفذت الكمية"))
    : "";
  const base = stockNote ? `${item.title} (${stockNote})` : item.title;
  const price = item.compareAtPriceDA && item.compareAtPriceDA > item.priceDA
    ? `${fmtDA(item.compareAtPriceDA)} → ${fmtDA(item.priceDA)}`
    : fmtDA(item.priceDA);
  const points = typeof item.points === "number" && item.points > 0
    ? (isFr ? ` | Points DXN: ${item.points}` : ` | نقاط DXN: ${item.points}`)
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
  const isFr = lang === "fr";
  const title =
    intent === Intent.PRODUCT_PRICE
      ? isFr ? "Prix actuels :" : "الأسعار الحالية:"
      : intent === Intent.PRODUCT_AVAILABILITY
      ? isFr ? "Disponibilité :" : "التوفر:"
      : isFr ? "Voici les produits :" : "إليك المنتجات:";
  return `${title}\n${lines.join("\n")}`;
}

export function recommendationResponse(
  items: CatalogItem[],
  lang: LanguageCode,
  matchedTerms: string[]
): string {
  const isFr = lang === "fr";
  if (items.length === 0) {
    return isFr
      ? "Merci pour votre question ! Je vous propose nos produits actuels :"
      : "شكرًا لسؤالك! اقترحك لنا منتجاتنا الحالية في المتجر:";
  }
  const lines = items.slice(0, 3).map((p) => card(p, lang, true));
  return isFr
    ? `Selon votre demande, voici nos suggestions disponibles :\n${lines.join("\n")}`
    : `انطلاقًا من طلبك، هذه اقتراحاتنا المتوفرة:\n${lines.join("\n")}`;
}

/**
 * Bounded catalog listing rendered from ACTUAL retrieved products (Phase 5
 * F-3). Shows the catalog's own entries with verified prices and storefront
 * links; never fabricated items.
 */
export function catalogResponse(items: CatalogItem[], lang: LanguageCode): string {
  const isFr = lang === "fr";
  if (items.length === 0) {
    return isFr
      ? "Voici nos produits actuels :\nVérifiez la boutique."
      : "إليك منتجاتنا الحالية:\nزيد تحقق في المتجر.";
  }
  const lines = items.slice(0, 5).map((p) => card(p, lang, true, false));
  return isFr
    ? `Voici nos produits actuels :\n${lines.join("\n")}`
    : `إليك منتجاتنا الحالية:\n${lines.join("\n")}`;
}

export function shippingResponse(shipping: ShippingInfo | undefined, lang: LanguageCode): string {
  const isFr = lang === "fr";
  if (!shipping) {
    return isFr
      ? "La livraison est disponible pour toutes les wilayas en domicile ou en bureau de poste. Contactez-nous pour confirmation."
      : "التوصيل متوفر لكل الولايات عن طريق التوصيل المنزلي أو لمكتب البريد. للتأكيد، تواصل معنا مباشرة.";
  }
  const parts: string[] = [];
  if (shipping.wilaya) {
    parts.push(
      isFr
        ? `Livraison vers ${shipping.wilaya} :`
        : `التوصيل إلى ${shipping.wilaya}:`
    );
  }
  const lines: string[] = [];
  if (shipping.homeDelivery) {
    const homePrice = shipping.homePriceDA;
    if (homePrice !== undefined) {
      lines.push(
        isFr
          ? `• Domicile : ${fmtDA(homePrice)}`
          : `• للمنزل: ${fmtDA(homePrice)}`
      );
    } else if (shipping.shippingConfigured === false) {
      lines.push(
        isFr
          ? "• Domicile : non défini (contactez-nous pour confirmation)"
          : "• للمنزل: غير محدد (تواصل معنا للتأكيد)"
      );
    } else {
      lines.push(
        isFr
          ? "• Domicile : selon wilaya"
          : "• للمنزل: حسب الولاية"
      );
    }
  }
  if (shipping.officeDelivery) {
    const officePrice = shipping.officePriceDA;
    if (officePrice !== undefined) {
      lines.push(
        isFr
          ? `• Bureau de poste : ${fmtDA(officePrice)}`
          : `• لمكتب البريد: ${fmtDA(officePrice)}`
      );
    } else if (shipping.shippingConfigured === false) {
      lines.push(
        isFr
          ? "• Bureau de poste : non défini (contactez-nous pour confirmation)"
          : "• لمكتب البريد: غير محدد (تواصل معنا للتأكيد)"
      );
    } else {
      lines.push(
        isFr
          ? "• Bureau de poste : selon wilaya"
          : "• لمكتب البريد: حسب الولاية"
      );
    }
  }
  if (lines.length) parts.push(lines.join("\n"));
  if (parts.length === (shipping.wilaya ? 1 : 0)) {
    return isFr
      ? "La livraison est disponible, mais les frais ne sont pas définis pour le moment. Contactez-nous pour confirmation."
      : "التوصيل متوفر، لكن الرسوم غير محددة حاليًا. تواصل معنا للتأكيد.";
  }
  return parts.join("\n");
}

export function offersResponse(offers: any[], lang: LanguageCode): string {
  const isFr = lang === "fr";
  if (!offers || offers.length === 0) {
    return isFr
      ? "Aucune offre en ce moment, mais restez à l'écoute !"
      : "لا توجد عروض حالية الآن، لكن تابعنا لأي جديد!";
  }
  const lines = offers.slice(0, 3).map((o) => {
    const label =
      o.label ||
      (o.type === "percentage"
        ? isFr ? `-${o.value}%` : `خصم ${o.value}%`
        : o.type === "fixed"
        ? isFr ? `-${fmtDA(o.value)}` : `خصم ${fmtDA(o.value)}`
        : o.title);
    return `• ${o.title} — ${label}`;
  });
  return isFr
    ? `Offres actuelles :\n${lines.join("\n")}`
    : `العروض الحالية:\n${lines.join("\n")}`;
}

export function paymentResponse(lang: LanguageCode): string {
  const isFr = lang === "fr";
  return isFr
    ? "Moyens de paiement disponibles : paiement à la livraison uniquement (espèces à la réception)."
    : "طرق الدفع المتاحة: الدفع عند الاستلام فقط (كاش عند التسليم).";
}

export function orderHelpResponse(lang: LanguageCode): string {
  const isFr = lang === "fr";
  return isFr
    ? "Pour toute question sur votre commande, partagez son numéro (ex : DXN-2024-00001) ou contactez-nous."
    : "للاستفسار عن طلبك، شاركنا رقم الطلب (مثل DXN-2024-00001) أو تواصل معنا وسنساعدك.";
}
