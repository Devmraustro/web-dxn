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
import { CatalogItem, Intent, LanguageCode, ShippingInfo } from "./types";

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

function card(item: CatalogItem, lang: LanguageCode, link: boolean): string {
  const note = item.available ? "" : lang === "ar" ? " (نفذت الكمية)" : " (Rupture de stock)";
  const base = `${item.title}${note}`;
  const price = item.compareAtPriceDA && item.compareAtPriceDA > item.priceDA
    ? `${fmtDA(item.compareAtPriceDA)} → ${fmtDA(item.priceDA)}`
    : fmtDA(item.priceDA);
  const url = link ? ` 🔗 ${item.storeUrl}` : "";
  return `• ${base} — ${price}${url}`;
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
    lines.push(
      lang === "ar"
        ? `• للمنزل: ${shipping.homePriceDA !== undefined ? fmtDA(shipping.homePriceDA) : "حسب الولاية"}`
        : `• Domicile : ${shipping.homePriceDA !== undefined ? fmtDA(shipping.homePriceDA) : "selon wilaya"}`
    );
  }
  if (shipping.officeDelivery) {
    lines.push(
      lang === "ar"
        ? `• لمكتب البريد: ${shipping.officePriceDA !== undefined ? fmtDA(shipping.officePriceDA) : "حسب الولاية"}`
        : `• Bureau de poste : ${shipping.officePriceDA !== undefined ? fmtDA(shipping.officePriceDA) : "selon wilaya"}`
    );
  }
  if (lines.length) parts.push(lines.join("\n"));
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
    ? "طرق الدفع المتاحة: الدفع عند الاستلام (كاش) أو BaridiMob. BaridiMob يتطلب تحققًا من طرف صاحب المتجر."
    : "Moyens de paiement disponibles : paiement à la livraison (espèces) ou BaridiMob. BaridiMob nécessite une vérification par le propriétaire.";
}

export function orderHelpResponse(lang: LanguageCode): string {
  return lang === "ar"
    ? "للاستفسار عن طلبك، شاركنا رقم الطلب (مثل DXN-2024-00001) أو تواصل معنا وسنساعدك."
    : "Pour toute question sur votre commande, partagez son numéro (ex : DXN-2024-00001) ou contactez-nous.";
}
