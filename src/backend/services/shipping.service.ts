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

export default { resolveShippingFee, defaultShippingFee };
