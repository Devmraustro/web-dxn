import { ShippingRate, Wilaya } from "../../Database/Models";
import { escapeRegex } from "../../utils/regex";
import { roundMoney } from "./commerce";

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

/**
 * Default shipping fee from env when no ShippingRate row is configured.
 * DEFAULT_SHIPPING_HOME / DEFAULT_SHIPPING_OFFICE, both defaulting to 0 —
 * the store owner must configure either per-wilaya rates or these defaults.
 */
export function defaultShippingFee(method: "home" | "office"): number {
  const raw =
    method === "home" ? process.env.DEFAULT_SHIPPING_HOME : process.env.DEFAULT_SHIPPING_OFFICE;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Resolve the authoritative shipping fee for a delivery method.
 * `wilayaInput` may be a wilaya ObjectId or a wilaya name (any of the
 * canonical spellings). Order-creation and the public /calculate endpoint
 * share this exact function so the customer is charged what was shown.
 */
export async function resolveShippingFee(
  wilayaInput: string,
  method: "home" | "office"
): Promise<number> {
  const input = typeof wilayaInput === "string" ? wilayaInput.trim() : "";
  if (!input) return defaultShippingFee(method);

  let rate = null;
  if (OBJECT_ID_RE.test(input)) {
    rate = await ShippingRate.findOne({ wilayaId: input, deliveryMethod: method, isActive: true }).lean();
  } else {
    // Match any canonical spelling (romanized / French / Arabic) case-insensitively.
    const wilaya = await Wilaya.findOne({
      $or: [
        { name: { $regex: `^${escapeRegex(input)}$`, $options: "i" } },
        { nameFr: { $regex: `^${escapeRegex(input)}$`, $options: "i" } },
        { nameAr: { $regex: `^${escapeRegex(input)}$` } },
      ],
      isActive: true,
    }).lean();
    if (wilaya) {
      rate = await ShippingRate.findOne({ wilayaId: wilaya._id, deliveryMethod: method, isActive: true }).lean();
    }
  }

  if (rate && typeof rate.price === "number" && rate.price >= 0) {
    return roundMoney(rate.price);
  }
  return defaultShippingFee(method);
}

/**
 * Verified wilaya-aware shipping resolution for order creation.
 *
 * Unlike `resolveShippingFee`, an unrecognized wilaya (not in the 58-wilaya
 * canonical dataset / Wilaya collection) is a hard failure (`null`) instead of
 * silently falling back to the default fee. A recognized wilaya with no
 * configured ShippingRate still falls back to the env default per DXN rules.
 */
export async function resolveShippingFeeStrict(
  wilayaInput: string,
  method: "home" | "office"
): Promise<number | null> {
  const input = typeof wilayaInput === "string" ? wilayaInput.trim() : "";
  if (!input) return null;

  if (OBJECT_ID_RE.test(input)) {
    const wilaya = await Wilaya.findOne({ _id: input, isActive: true }).select("_id").lean();
    if (!wilaya) return null;
    const rate = await ShippingRate.findOne({ wilayaId: wilaya._id, deliveryMethod: method, isActive: true }).lean();
    if (rate && typeof rate.price === "number" && rate.price >= 0) return roundMoney(rate.price);
    return defaultShippingFee(method);
  }

  const wilaya = await Wilaya.findOne({
    $or: [
      { name: { $regex: `^${escapeRegex(input)}$`, $options: "i" } },
      { nameFr: { $regex: `^${escapeRegex(input)}$`, $options: "i" } },
      { nameAr: { $regex: `^${escapeRegex(input)}$` } },
    ],
    isActive: true,
  }).select("_id").lean();
  if (!wilaya) return null;

  const rate = await ShippingRate.findOne({ wilayaId: wilaya._id, deliveryMethod: method, isActive: true }).lean();
  if (rate && typeof rate.price === "number" && rate.price >= 0) return roundMoney(rate.price);
  return defaultShippingFee(method);
}

export default { resolveShippingFee, resolveShippingFeeStrict, defaultShippingFee };
