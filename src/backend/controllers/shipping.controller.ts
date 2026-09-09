import { Request, Response } from "express";
import { Wilaya, ShippingRate } from "../../Database/Models";
import { ALGERIAN_WILAYAS } from "../data/algerianWilayas";
import { resolveShippingFee, defaultShippingFee } from "../services/shipping.service";

/**
 * Seed the full canonical 58-wilaya dataset when the collection is empty.
 * Existing installations are left untouched (never overwrite admin data).
 */
export const initializeDefaultWilayas = async () => {
  const wilayaCount = await Wilaya.countDocuments({});
  if (wilayaCount === 0) {
    for (const w of ALGERIAN_WILAYAS) {
      await Wilaya.create({
        code: w.code,
        name: w.name,
        nameFr: w.nameFr,
        nameAr: w.nameAr,
        sortOrder: w.code,
        isActive: true,
      });
    }
    console.log(`Default wilayas initialized (${ALGERIAN_WILAYAS.length})`);
  }
  return wilayaCount;
};

// GET /api/shipping/wilayas - Get active wilayas (public, ordered by code)
export const getWilayas = async (req: Request, res: Response) => {
  try {
    const wilayas = await Wilaya.find({ isActive: true })
      .sort({ code: 1, sortOrder: 1, name: 1 })
      .lean();

    res.json({ success: true, count: wilayas.length, data: wilayas });
  } catch (error) {
    console.error("Get wilayas error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/shipping/rate - Get configured shipping rate row
export const getShippingRate = async (req: Request, res: Response) => {
  try {
    const { wilayaId, deliveryMethod } = req.query;
    if (!wilayaId || (deliveryMethod !== "home" && deliveryMethod !== "office")) {
      return res.status(400).json({ message: "wilayaId and deliveryMethod (home|office) are required" });
    }

    const rate = await ShippingRate.findOne({
      wilayaId: wilayaId as string,
      deliveryMethod,
      isActive: true,
    }).lean();

    res.json({ success: true, data: rate || null });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Cast to ObjectId")) {
      return res.status(400).json({ message: "Invalid wilayaId format" });
    }
    console.error("Get shipping rate error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/** Shared fee resolver for GET and POST /calculate. */
async function calculateFromInput(wilayaInput: string, deliveryMethod: string) {
  if (!wilayaInput) {
    return { error: { message: "wilayaId is required" } as const, fee: 0 };
  }
  if (deliveryMethod !== "home" && deliveryMethod !== "office") {
    return { error: { message: "deliveryMethod must be home or office" } as const, fee: 0 };
  }
  const fee = await resolveShippingFee(wilayaInput, deliveryMethod);
  return { fee, wilaya: wilayaInput, deliveryMethod };
}

// GET /api/shipping/calculate?wilayaId=...&deliveryMethod=home — used by the
// checkout form (provisional estimate). POST also supported for API clients.
export const calculateShipping = async (req: Request, res: Response) => {
  try {
    const wilayaId = String((req.query?.wilayaId as string) || (req.body?.wilayaId as string) || "");
    const deliveryMethod = String((req.query?.deliveryMethod as string) || (req.body?.deliveryMethod as string) || "");
    const result = await calculateFromInput(wilayaId, deliveryMethod);
    if (result.error) {
      return res.status(400).json({ message: result.error.message });
    }
    res.json({ success: true, data: { shippingFee: result.fee, deliveryMethod, wilayaId } });
  } catch (error) {
    console.error("Calculate shipping error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/shipping/zones - Get shipping zones configuration (public read)
export const getShippingZones = async (req: Request, res: Response) => {
  try {
    const wilayas = await Wilaya.find({ isActive: true })
      .sort({ code: 1, sortOrder: 1, name: 1 })
      .lean();

    const zones = wilayas.map((wilaya: any) => ({
      id: wilaya._id,
      code: wilaya.code,
      name: wilaya.name,
      home: defaultShippingFee("home"),
      office: defaultShippingFee("office"),
    }));

    res.json({ success: true, data: zones });
  } catch (error) {
    console.error("Get shipping zones error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/shipping/setup - Upsert a shipping rate (admin)
export const setupShippingRate = async (req: Request, res: Response) => {
  try {
    const { wilayaId, deliveryMethod, price } = req.body;

    if (!wilayaId || (deliveryMethod !== "home" && deliveryMethod !== "office")) {
      return res.status(400).json({ message: "wilayaId and deliveryMethod (home|office) are required" });
    }
    const p = Number(price);
    if (!Number.isFinite(p) || p < 0 || p > 100000) {
      return res.status(400).json({ message: "price must be a number between 0 and 100000" });
    }

    // Verify the wilaya exists so we never attach a rate to a phantom id.
    const wilaya = await Wilaya.findById(wilayaId).lean();
    if (!wilaya) {
      return res.status(400).json({ message: "Wilaya not found" });
    }

    const shippingRate = await ShippingRate.findOneAndUpdate(
      { wilayaId, deliveryMethod },
      { price: p, isActive: true },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, data: shippingRate });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Cast to ObjectId")) {
      return res.status(400).json({ message: "Invalid wilayaId format" });
    }
    console.error("Setup shipping rate error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/shipping/rate/:wilayaId/:deliveryMethod - Remove a shipping rate (admin)
export const deleteShippingRate = async (req: Request, res: Response) => {
  try {
    const { wilayaId, deliveryMethod } = req.params;
    if (!wilayaId || (deliveryMethod !== "home" && deliveryMethod !== "office")) {
      return res.status(400).json({ message: "wilayaId and deliveryMethod (home|office) are required" });
    }

    const result = await ShippingRate.findOneAndDelete({ wilayaId, deliveryMethod });
    if (!result) {
      return res.status(404).json({ message: "Shipping rate not found" });
    }
    res.json({ success: true, message: "Shipping rate deleted" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Cast to ObjectId")) {
      return res.status(400).json({ message: "Invalid wilayaId format" });
    }
    console.error("Delete shipping rate error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export default {
  initializeDefaultWilayas,
  getWilayas,
  getShippingRate,
  calculateShipping,
  getShippingZones,
  setupShippingRate,
  deleteShippingRate,
};
