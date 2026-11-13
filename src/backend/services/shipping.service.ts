import mongoose from "mongoose";
import { Wilaya, ShippingRate } from "../../Database/Models";
import {
  ALGERIAN_WILAYAS,
  AlgerianWilaya,
  WilayaCoverageStatus,
  findCanonicalWilaya,
  findParentWilaya,
} from "../data/algerianWilayas";
import { roundMoney } from "./commerce";

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

function isModelQueryable(Model: any, method: string): boolean {
  if (!Model || typeof Model[method] !== "function") return false;
  if ((Model[method] as any)._isMockFunction) return true;
  return mongoose.connection.readyState === 1;
}

export function defaultShippingFee(deliveryMethod: "home" | "office"): number {
  // Read the env vars at call time (not at module load) so runtime/test
  // environment changes are honored; invalid or negative values clamp to 0.
  const envKey = deliveryMethod === "home" ? "DEFAULT_SHIPPING_HOME" : "DEFAULT_SHIPPING_OFFICE";
  const parsed = Number(process.env[envKey]);
  return roundMoney(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
}

export interface ShippingQuoteResult {
  recognized: boolean;
  deliverable: boolean;
  reason?: "invalid_wilaya" | "wilaya_unserved" | "delivery_method_unavailable";
  shippingFee: number | null;
  rateSource: "wilaya_rate" | "parent_wilaya_rate" | "default" | "unavailable";
  wilayaCode?: number;
  wilayaName?: string;
  wilayaNameAr?: string;
  wilayaNameFr?: string;
  parentWilayaCode?: number | null;
  parentWilayaName?: string | null;
  parentWilayaNameAr?: string | null;
  parentWilayaNameFr?: string | null;
  coverageStatus?: WilayaCoverageStatus;
  homeDeliverySupported?: boolean;
  officeDeliverySupported?: boolean;
  coverageNoticeAr?: string;
  coverageNoticeFr?: string;
}

function buildCoverageNotices(params: {
  coverageStatus: WilayaCoverageStatus;
  wilayaAr: string;
  wilayaFr: string;
  parentAr?: string | null;
  parentFr?: string | null;
  customNoteAr?: string;
  customNoteFr?: string;
  deliverable: boolean;
  reason?: ShippingQuoteResult["reason"];
  deliveryMethod: "home" | "office";
}): { ar: string; fr: string } {
  if (params.customNoteAr || params.customNoteFr) {
    return {
      ar: params.customNoteAr || params.customNoteFr || "",
      fr: params.customNoteFr || params.customNoteAr || "",
    };
  }

  if (!params.deliverable) {
    if (params.reason === "delivery_method_unavailable") {
      return params.deliveryMethod === "office"
        ? {
            ar: `التوصيل إلى المكتب (Stop-Desk) غير متوفر حالياً في ولاية ${params.wilayaAr}. يرجى اختيار التوصيل للمنزل أو التواصل معنا لتأكيد التغطية.`,
            fr: `La livraison au bureau (Stop-Desk) n'est pas disponible actuellement pour la wilaya de ${params.wilayaFr}. Veuillez choisir la livraison à domicile ou nous contacter.`,
          }
        : {
            ar: `التوصيل للمنزل غير متوفر حالياً في ولاية ${params.wilayaAr}. يرجى اختيار استلام من المكتب أو التواصل معنا.`,
            fr: `La livraison à domicile n'est pas disponible actuellement pour la wilaya de ${params.wilayaFr}. Veuillez choisir le retrait au bureau ou nous contacter.`,
          };
    }
    return {
      ar: `شركة التوصيل المعتمدة لا تغطي حالياً ولاية ${params.wilayaAr}. يرجى التواصل معنا عبر واتساب أو صفحة الاتصال قبل الطلب للتحقق من بدائل الإرسال.`,
      fr: `Notre transporteur partenaire ne dessert pas actuellement la wilaya de ${params.wilayaFr}. Veuillez nous contacter avant de commander pour vérifier les alternatives d'expédition.`,
    };
  }

  if (params.coverageStatus === "via_parent_wilaya") {
    const parentAr = params.parentAr ? ` (${params.parentAr})` : "";
    const parentFr = params.parentFr ? ` (${params.parentFr})` : "";
    return {
      ar: `ولاية مستحدثة بموجب القانون 26-06: يتم توجيه الطرود حالياً عبر شبكات التوصيل التابعة للولاية الأم${parentAr} وحسب البلدية مع تأكيد هاتفي قبل الإرسال.`,
      fr: `Nouvelle wilaya (Loi 26-06) : l'acheminement par le transporteur s'effectue via le réseau de la wilaya mère${parentFr} et la commune, avec confirmation téléphonique avant expédition.`,
    };
  }

  if (params.coverageStatus === "confirm_by_phone") {
    return {
      ar: `تخضع تغطية وآجال التوصيل في ولاية ${params.wilayaAr} لتأكيد شركة التوصيل هاتفياً حسب البلدية قبل شحن الطلب.`,
      fr: `La desserte et les délais pour la wilaya de ${params.wilayaFr} sont confirmés par téléphone selon la commune et la couverture effective du transporteur avant expédition.`,
    };
  }

  return { ar: "", fr: "" };
}

async function findWilayaDoc(canonical?: AlgerianWilaya, rawId?: string): Promise<any | null> {
  if (!isModelQueryable(Wilaya, "findOne")) return null;

  if (rawId && OBJECT_ID_RE.test(rawId) && isModelQueryable(Wilaya, "findById")) {
    const byId = Wilaya.findById(rawId);
    const resolved = byId && typeof byId.lean === "function" ? await byId.lean() : await byId;
    if (resolved) return resolved;
  }

  if (!canonical) return null;

  const query = Wilaya.findOne({
    $or: [
      { code: canonical.code },
      { name: canonical.name },
      { nameFr: canonical.nameFr },
      { nameAr: canonical.nameAr },
    ],
  });
  return query && typeof query.lean === "function" ? await query.lean() : await query;
}

async function findActiveRateForWilayaDoc(
  wilayaDocId: unknown,
  deliveryMethod: "home" | "office"
): Promise<any | null> {
  if (!wilayaDocId || !isModelQueryable(ShippingRate, "findOne")) return null;
  const query = ShippingRate.findOne({
    wilayaId: wilayaDocId,
    deliveryMethod,
    isActive: true,
  });
  return query && typeof query.lean === "function" ? await query.lean() : await query;
}

/**
 * Authoritative shipping quote + courier-coverage resolution across all 69
 * official Algerian wilayas:
 *  - Validates `wilayaInput` against MongoDB `Wilaya` / `ALGERIAN_WILAYAS` (01–69).
 *  - Evaluates configurable per-wilaya courier coverage (`coverageStatus`,
 *    `homeDeliverySupported`, `officeDeliverySupported`, `isActive`).
 *  - Resolves custom `ShippingRate` for the wilaya, falling back to its parent
 *    wilaya's `ShippingRate` for newly created 2026 wilayas (`59–69`), and
 *    finally to `DEFAULT_SHIPPING_HOME` / `DEFAULT_SHIPPING_OFFICE`.
 */
export async function resolveShippingQuote(
  wilayaInput: string | number | undefined | null,
  deliveryMethod: "home" | "office"
): Promise<ShippingQuoteResult> {
  const method: "home" | "office" = deliveryMethod === "office" ? "office" : "home";
  const raw = wilayaInput === undefined || wilayaInput === null ? "" : String(wilayaInput).trim();
  if (!raw) {
    return {
      recognized: false,
      deliverable: false,
      reason: "invalid_wilaya",
      shippingFee: null,
      rateSource: "unavailable",
    };
  }

  let canonical = findCanonicalWilaya(raw);
  const wilayaDoc = await findWilayaDoc(canonical, raw);

  if (!canonical && wilayaDoc) {
    canonical =
      findCanonicalWilaya(wilayaDoc.code ?? wilayaDoc.name ?? wilayaDoc.nameFr ?? wilayaDoc.nameAr) ||
      undefined;
  }

  if (!canonical && !wilayaDoc) {
    return {
      recognized: false,
      deliverable: false,
      reason: "invalid_wilaya",
      shippingFee: null,
      rateSource: "unavailable",
    };
  }

  const parentCanonical =
    findParentWilaya(canonical) ||
    (wilayaDoc?.parentCode ? ALGERIAN_WILAYAS.find((w) => w.code === Number(wilayaDoc.parentCode)) : undefined);

  const coverageStatus: WilayaCoverageStatus =
    wilayaDoc?.isActive === false
      ? "unserved"
      : (wilayaDoc?.coverageStatus as WilayaCoverageStatus | undefined) ||
        canonical?.defaultCoverageStatus ||
        "served";

  const homeSupported =
    typeof wilayaDoc?.homeDeliverySupported === "boolean"
      ? wilayaDoc.homeDeliverySupported
      : (canonical?.defaultHomeDelivery ?? true);

  const officeSupported =
    typeof wilayaDoc?.officeDeliverySupported === "boolean"
      ? wilayaDoc.officeDeliverySupported
      : (canonical?.defaultOfficeDelivery ?? true);

  const wilayaCode = wilayaDoc?.code ?? canonical?.code;
  const wilayaName = canonical?.name ?? wilayaDoc?.name ?? raw;
  const wilayaNameAr = wilayaDoc?.nameAr || canonical?.nameAr || wilayaName;
  const wilayaNameFr = wilayaDoc?.nameFr || canonical?.nameFr || wilayaName;
  const parentCode = wilayaDoc?.parentCode ?? canonical?.parentCode ?? null;
  const parentName = wilayaDoc?.parentName ?? canonical?.parentName ?? parentCanonical?.name ?? null;
  const parentNameAr = parentCanonical?.nameAr ?? parentName;
  const parentNameFr = parentCanonical?.nameFr ?? parentName;

  if (coverageStatus === "unserved") {
    const notices = buildCoverageNotices({
      coverageStatus,
      wilayaAr: wilayaNameAr,
      wilayaFr: wilayaNameFr,
      parentAr: parentNameAr,
      parentFr: parentNameFr,
      customNoteAr: wilayaDoc?.coverageNoteAr,
      customNoteFr: wilayaDoc?.coverageNoteFr,
      deliverable: false,
      reason: "wilaya_unserved",
      deliveryMethod: method,
    });
    return {
      recognized: true,
      deliverable: false,
      reason: "wilaya_unserved",
      shippingFee: null,
      rateSource: "unavailable",
      wilayaCode,
      wilayaName,
      wilayaNameAr,
      wilayaNameFr,
      parentWilayaCode: parentCode,
      parentWilayaName: parentName,
      parentWilayaNameAr: parentNameAr,
      parentWilayaNameFr: parentNameFr,
      coverageStatus,
      homeDeliverySupported: homeSupported,
      officeDeliverySupported: officeSupported,
      coverageNoticeAr: notices.ar,
      coverageNoticeFr: notices.fr,
    };
  }

  const methodSupported = method === "home" ? homeSupported : officeSupported;
  if (!methodSupported) {
    const notices = buildCoverageNotices({
      coverageStatus,
      wilayaAr: wilayaNameAr,
      wilayaFr: wilayaNameFr,
      parentAr: parentNameAr,
      parentFr: parentNameFr,
      customNoteAr: wilayaDoc?.coverageNoteAr,
      customNoteFr: wilayaDoc?.coverageNoteFr,
      deliverable: false,
      reason: "delivery_method_unavailable",
      deliveryMethod: method,
    });
    return {
      recognized: true,
      deliverable: false,
      reason: "delivery_method_unavailable",
      shippingFee: null,
      rateSource: "unavailable",
      wilayaCode,
      wilayaName,
      wilayaNameAr,
      wilayaNameFr,
      parentWilayaCode: parentCode,
      parentWilayaName: parentName,
      parentWilayaNameAr: parentNameAr,
      parentWilayaNameFr: parentNameFr,
      coverageStatus,
      homeDeliverySupported: homeSupported,
      officeDeliverySupported: officeSupported,
      coverageNoticeAr: notices.ar,
      coverageNoticeFr: notices.fr,
    };
  }

  // 1) Direct Wilaya ShippingRate
  if (wilayaDoc?._id) {
    const directRate = await findActiveRateForWilayaDoc(wilayaDoc._id, method);
    if (directRate && Number.isFinite(Number(directRate.price)) && Number(directRate.price) >= 0) {
      const notices = buildCoverageNotices({
        coverageStatus,
        wilayaAr: wilayaNameAr,
        wilayaFr: wilayaNameFr,
        parentAr: parentNameAr,
        parentFr: parentNameFr,
        customNoteAr: wilayaDoc?.coverageNoteAr,
        customNoteFr: wilayaDoc?.coverageNoteFr,
        deliverable: true,
        deliveryMethod: method,
      });
      return {
        recognized: true,
        deliverable: true,
        shippingFee: roundMoney(Number(directRate.price)),
        rateSource: "wilaya_rate",
        wilayaCode,
        wilayaName,
        wilayaNameAr,
        wilayaNameFr,
        parentWilayaCode: parentCode,
        parentWilayaName: parentName,
        parentWilayaNameAr: parentNameAr,
        parentWilayaNameFr: parentNameFr,
        coverageStatus,
        homeDeliverySupported: homeSupported,
        officeDeliverySupported: officeSupported,
        coverageNoticeAr: notices.ar,
        coverageNoticeFr: notices.fr,
      };
    }
  }

  // 2) Parent-wilaya ShippingRate fallback for Law 26-06 wilayas (59–69)
  if (parentCanonical) {
    const parentDoc = await findWilayaDoc(parentCanonical);
    if (parentDoc?._id) {
      const parentRate = await findActiveRateForWilayaDoc(parentDoc._id, method);
      if (parentRate && Number.isFinite(Number(parentRate.price)) && Number(parentRate.price) >= 0) {
        const notices = buildCoverageNotices({
          coverageStatus,
          wilayaAr: wilayaNameAr,
          wilayaFr: wilayaNameFr,
          parentAr: parentNameAr,
          parentFr: parentNameFr,
          customNoteAr: wilayaDoc?.coverageNoteAr,
          customNoteFr: wilayaDoc?.coverageNoteFr,
          deliverable: true,
          deliveryMethod: method,
        });
        return {
          recognized: true,
          deliverable: true,
          shippingFee: roundMoney(Number(parentRate.price)),
          rateSource: "parent_wilaya_rate",
          wilayaCode,
          wilayaName,
          wilayaNameAr,
          wilayaNameFr,
          parentWilayaCode: parentCode,
          parentWilayaName: parentName,
          parentWilayaNameAr: parentNameAr,
          parentWilayaNameFr: parentNameFr,
          coverageStatus,
          homeDeliverySupported: homeSupported,
          officeDeliverySupported: officeSupported,
          coverageNoticeAr: notices.ar,
          coverageNoticeFr: notices.fr,
        };
      }
    }
  }

  // 3) Environment default shipping fee
  const notices = buildCoverageNotices({
    coverageStatus,
    wilayaAr: wilayaNameAr,
    wilayaFr: wilayaNameFr,
    parentAr: parentNameAr,
    parentFr: parentNameFr,
    customNoteAr: wilayaDoc?.coverageNoteAr,
    customNoteFr: wilayaDoc?.coverageNoteFr,
    deliverable: true,
    deliveryMethod: method,
  });

  return {
    recognized: true,
    deliverable: true,
    shippingFee: defaultShippingFee(method),
    rateSource: "default",
    wilayaCode,
    wilayaName,
    wilayaNameAr,
    wilayaNameFr,
    parentWilayaCode: parentCode,
    parentWilayaName: parentName,
    parentWilayaNameAr: parentNameAr,
    parentWilayaNameFr: parentNameFr,
    coverageStatus,
    homeDeliverySupported: homeSupported,
    officeDeliverySupported: officeSupported,
    coverageNoticeAr: notices.ar,
    coverageNoticeFr: notices.fr,
  };
}

/**
 * Permissive shipping fee helper (falls back to default fee when wilaya is
 * omitted/unknown; kept for non-strict estimate callers).
 */
export async function resolveShippingFee(
  wilayaInput: string | undefined | null,
  deliveryMethod: "home" | "office"
): Promise<number> {
  const quote = await resolveShippingQuote(wilayaInput, deliveryMethod);
  if (quote.shippingFee !== null) return quote.shippingFee;
  return defaultShippingFee(deliveryMethod);
}

/**
 * Strict checkout shipping resolution: returns `null` when the wilaya is
 * unrecognized OR when courier coverage/delivery method is configured as
 * unavailable for that wilaya.
 */
export async function resolveShippingFeeStrict(
  wilayaInput: string | undefined | null,
  deliveryMethod: "home" | "office"
): Promise<number | null> {
  const quote = await resolveShippingQuote(wilayaInput, deliveryMethod);
  if (!quote.recognized || !quote.deliverable || quote.shippingFee === null) {
    return null;
  }
  return quote.shippingFee;
}
