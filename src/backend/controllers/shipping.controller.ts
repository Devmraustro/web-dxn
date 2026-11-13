import mongoose from "mongoose";
import { Request, Response } from "express";
import { Wilaya, ShippingRate } from "../../Database/Models";
import {
  ALGERIAN_WILAYAS,
  WilayaCoverageStatus,
  findCanonicalWilaya,
} from "../data/algerianWilayas";
import { defaultShippingFee, resolveShippingQuote } from "../services/shipping.service";
import { recordAuditLog } from "../services/audit.service";
import type { AuthRequest } from "../middleware/auth.middleware";

const VALID_COVERAGE_STATUSES = new Set<WilayaCoverageStatus>([
  "served",
  "via_parent_wilaya",
  "confirm_by_phone",
  "unserved",
]);

function isDbQueryable(Model: any, method: string): boolean {
  if (!Model || typeof Model[method] !== "function") return false;
  if ((Model[method] as any)._isMockFunction) return true;
  return mongoose.connection.readyState === 1;
}

/**
 * Seed and idempotently reconcile the canonical 69-wilaya dataset (Law n° 26-06
 * of 4 April 2026 & Presidential Decree n° 26-206 of 25 May 2026):
 *  - Empty collection → inserts all 69 wilayas and default home/office rates.
 *  - Existing 58-wilaya collection (or partial collection) → inserts missing
 *    canonical wilayas (e.g. codes 59–69) + their default rates, and backfills
 *    missing `code`, `nameFr`, `nameAr`, `parentCode`, `parentName`,
 *    `reformYear`, and `aliases` WITHOUT overwriting admin-configured
 *    `isActive`, `coverageStatus`, `homeDeliverySupported`,
 *    `officeDeliverySupported`, or existing `ShippingRate.price` values.
 *  - Historical `Order` and `Customer` documents are never modified.
 */
export const initializeDefaultWilayas = async (): Promise<{
  insertedWilayas: number;
  updatedWilayas: number;
  insertedRates: number;
}> => {
  const stats = { insertedWilayas: 0, updatedWilayas: 0, insertedRates: 0 };
  try {
    const existing = await Wilaya.find().lean();

    if (existing.length === 0) {
      const inserted = await Wilaya.insertMany(
        ALGERIAN_WILAYAS.map((w) => ({
          code: w.code,
          name: w.name,
          nameFr: w.nameFr,
          nameAr: w.nameAr,
          aliases: w.aliases || [],
          reformYear: w.reformYear,
          parentCode: w.parentCode ?? null,
          parentName: w.parentName ?? null,
          coverageStatus: w.defaultCoverageStatus,
          homeDeliverySupported: w.defaultHomeDelivery,
          officeDeliverySupported: w.defaultOfficeDelivery,
          isActive: true,
          sortOrder: w.code,
        }))
      );
      stats.insertedWilayas = inserted.length;

      const homePrice = defaultShippingFee("home");
      const officePrice = defaultShippingFee("office");
      const rates = inserted.flatMap((w: any) => [
        { wilayaId: w._id, deliveryMethod: "home", price: homePrice, isActive: true },
        { wilayaId: w._id, deliveryMethod: "office", price: officePrice, isActive: true },
      ]);
      await ShippingRate.insertMany(rates);
      stats.insertedRates = rates.length;

      console.log(`Initialized ${inserted.length} Algerian wilayas (codes 01–69) with default shipping rates`);
      return stats;
    }

    // Reconcile existing wilayas non-destructively + insert any missing canonical codes (e.g. 59–69)
    const byCode = new Map<number, any>();
    const byFoldedName = new Map<string, any>();

    for (const row of existing) {
      if (typeof row.code === "number") {
        byCode.set(row.code, row);
      }
      const matched = findCanonicalWilaya(row.code ?? row.name ?? row.nameFr ?? row.nameAr);
      if (matched && !byCode.has(matched.code)) {
        byCode.set(matched.code, row);
      }
      if (row.name) {
        byFoldedName.set(String(row.name).trim().toLowerCase(), row);
      }
    }

    const homePrice = defaultShippingFee("home");
    const officePrice = defaultShippingFee("office");

    for (const canonical of ALGERIAN_WILAYAS) {
      const found =
        byCode.get(canonical.code) || byFoldedName.get(canonical.name.toLowerCase());

      if (!found) {
        const created = await Wilaya.create({
          code: canonical.code,
          name: canonical.name,
          nameFr: canonical.nameFr,
          nameAr: canonical.nameAr,
          aliases: canonical.aliases || [],
          reformYear: canonical.reformYear,
          parentCode: canonical.parentCode ?? null,
          parentName: canonical.parentName ?? null,
          coverageStatus: canonical.defaultCoverageStatus,
          homeDeliverySupported: canonical.defaultHomeDelivery,
          officeDeliverySupported: canonical.defaultOfficeDelivery,
          isActive: true,
          sortOrder: canonical.code,
        });
        stats.insertedWilayas += 1;

        for (const [method, price] of [
          ["home", homePrice],
          ["office", officePrice],
        ] as const) {
          const existingRate = await ShippingRate.findOne({
            wilayaId: created._id,
            deliveryMethod: method,
          }).lean();
          if (!existingRate) {
            await ShippingRate.create({
              wilayaId: created._id,
              deliveryMethod: method,
              price,
              isActive: true,
            });
            stats.insertedRates += 1;
          }
        }
        continue;
      }

      // Backfill only missing metadata fields — NEVER overwrite admin-configured coverage or active status
      const patch: Record<string, unknown> = {};
      if (typeof found.code !== "number") patch.code = canonical.code;
      if (!found.nameFr) patch.nameFr = canonical.nameFr;
      if (!found.nameAr) patch.nameAr = canonical.nameAr;
      if (!found.sortOrder) patch.sortOrder = canonical.code;
      if (canonical.reformYear && !found.reformYear) patch.reformYear = canonical.reformYear;
      if (canonical.parentCode && !found.parentCode) patch.parentCode = canonical.parentCode;
      if (canonical.parentName && !found.parentName) patch.parentName = canonical.parentName;
      if (!Array.isArray(found.aliases) || (found.aliases.length === 0 && canonical.aliases?.length)) {
        patch.aliases = canonical.aliases || [];
      }
      if (!found.coverageStatus) {
        patch.coverageStatus = canonical.defaultCoverageStatus;
      }
      if (typeof found.homeDeliverySupported !== "boolean") {
        patch.homeDeliverySupported = canonical.defaultHomeDelivery;
      }
      if (typeof found.officeDeliverySupported !== "boolean") {
        patch.officeDeliverySupported = canonical.defaultOfficeDelivery;
      }

      if (Object.keys(patch).length > 0) {
        await Wilaya.updateOne({ _id: found._id }, { $set: patch });
        stats.updatedWilayas += 1;
      }
    }

    if (stats.insertedWilayas > 0 || stats.updatedWilayas > 0) {
      console.log(
        `Reconciled Algerian wilayas (inserted=${stats.insertedWilayas}, updated=${stats.updatedWilayas}, rates=${stats.insertedRates})`
      );
    }
    return stats;
  } catch (error) {
    console.error("Failed to initialize wilayas:", error);
    return stats;
  }
};

function canonicalWilayaFallbackList() {
  return ALGERIAN_WILAYAS.map((w) => ({
    _id: `wilaya-${String(w.code).padStart(2, "0")}`,
    code: w.code,
    name: w.name,
    nameFr: w.nameFr,
    nameAr: w.nameAr,
    reformYear: w.reformYear ?? null,
    parentCode: w.parentCode ?? null,
    parentName: w.parentName ?? null,
    coverageStatus: w.defaultCoverageStatus,
    homeDeliverySupported: w.defaultHomeDelivery,
    officeDeliverySupported: w.defaultOfficeDelivery,
    coverageNoteAr: "",
    coverageNoteFr: "",
    isActive: true,
    sortOrder: w.code,
  }));
}

// GET /api/shipping/wilayas - Get all wilayas with bilingual names & courier coverage metadata
export const getWilayas = async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    if (!isDbQueryable(Wilaya, "find")) {
      return res.json({ success: true, data: canonicalWilayaFallbackList() });
    }

    const filter = includeInactive ? {} : { isActive: true };
    const dbWilayas = await Wilaya.find(filter)
      .sort({ code: 1, sortOrder: 1, name: 1 })
      .lean();

    if (!dbWilayas || dbWilayas.length === 0) {
      return res.json({ success: true, data: canonicalWilayaFallbackList() });
    }

    // Merge canonical 69 wilayas with DB overrides so even pre-migration DBs return all 69 cleanly
    const dbByCode = new Map<number, any>();
    for (const row of dbWilayas) {
      const canonical = findCanonicalWilaya(row.code ?? row.name ?? row.nameFr ?? row.nameAr);
      const code = typeof row.code === "number" ? row.code : canonical?.code;
      if (code) dbByCode.set(code, row);
    }

    const merged = ALGERIAN_WILAYAS.map((w) => {
      const dbRow = dbByCode.get(w.code);
      if (!dbRow) {
        return {
          _id: `wilaya-${String(w.code).padStart(2, "0")}`,
          code: w.code,
          name: w.name,
          nameFr: w.nameFr,
          nameAr: w.nameAr,
          reformYear: w.reformYear ?? null,
          parentCode: w.parentCode ?? null,
          parentName: w.parentName ?? null,
          coverageStatus: w.defaultCoverageStatus,
          homeDeliverySupported: w.defaultHomeDelivery,
          officeDeliverySupported: w.defaultOfficeDelivery,
          coverageNoteAr: "",
          coverageNoteFr: "",
          isActive: true,
          sortOrder: w.code,
        };
      }
      return {
        ...dbRow,
        code: dbRow.code ?? w.code,
        name: dbRow.name || w.name,
        nameFr: dbRow.nameFr || w.nameFr,
        nameAr: dbRow.nameAr || w.nameAr,
        reformYear: dbRow.reformYear ?? w.reformYear ?? null,
        parentCode: dbRow.parentCode ?? w.parentCode ?? null,
        parentName: dbRow.parentName ?? w.parentName ?? null,
        coverageStatus: dbRow.coverageStatus || w.defaultCoverageStatus,
        homeDeliverySupported:
          typeof dbRow.homeDeliverySupported === "boolean"
            ? dbRow.homeDeliverySupported
            : w.defaultHomeDelivery,
        officeDeliverySupported:
          typeof dbRow.officeDeliverySupported === "boolean"
            ? dbRow.officeDeliverySupported
            : w.defaultOfficeDelivery,
      };
    }).filter((w) => (includeInactive ? true : w.isActive !== false));

    res.json({ success: true, data: merged });
  } catch (error) {
    console.error("Get wilayas error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/shipping/rates - Get shipping rate for wilaya and delivery method
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

// GET/POST /api/shipping/calculate — authoritative shipping quote + courier coverage check
export const calculateShipping = async (req: Request, res: Response) => {
  try {
    const wilayaId = String((req.query?.wilayaId as string) || (req.body?.wilayaId as string) || "").trim();
    const deliveryMethod = String(
      (req.query?.deliveryMethod as string) || (req.body?.deliveryMethod as string) || ""
    ).trim();

    if (!wilayaId) {
      return res.status(400).json({ message: "wilayaId is required" });
    }
    if (deliveryMethod !== "home" && deliveryMethod !== "office") {
      return res.status(400).json({ message: "deliveryMethod must be home or office" });
    }

    const quote = await resolveShippingQuote(wilayaId, deliveryMethod);

    if (!quote.recognized) {
      return res.status(404).json({
        message: "Wilaya not found",
        code: "invalid_wilaya",
      });
    }

    if (!quote.deliverable || quote.shippingFee === null) {
      return res.status(400).json({
        message:
          quote.coverageNoticeFr ||
          "Delivery is not currently available for the selected wilaya or delivery method",
        code: quote.reason || "wilaya_unserved",
        data: {
          wilayaId,
          deliveryMethod,
          deliverable: false,
          reason: quote.reason,
          wilayaCode: quote.wilayaCode,
          wilayaName: quote.wilayaName,
          coverageStatus: quote.coverageStatus,
          homeDeliverySupported: quote.homeDeliverySupported,
          officeDeliverySupported: quote.officeDeliverySupported,
          coverageNoticeAr: quote.coverageNoticeAr || "",
          coverageNoticeFr: quote.coverageNoticeFr || "",
        },
      });
    }

    res.json({
      success: true,
      data: {
        shippingFee: quote.shippingFee,
        rateSource: quote.rateSource,
        deliveryMethod,
        wilayaId,
        deliverable: true,
        wilayaCode: quote.wilayaCode,
        wilayaName: quote.wilayaName,
        wilayaNameAr: quote.wilayaNameAr,
        wilayaNameFr: quote.wilayaNameFr,
        parentWilayaCode: quote.parentWilayaCode,
        parentWilayaName: quote.parentWilayaName,
        coverageStatus: quote.coverageStatus,
        homeDeliverySupported: quote.homeDeliverySupported,
        officeDeliverySupported: quote.officeDeliverySupported,
        coverageNoticeAr: quote.coverageNoticeAr || "",
        coverageNoticeFr: quote.coverageNoticeFr || "",
      },
    });
  } catch (error) {
    console.error("Calculate shipping error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/shipping/zones - Get shipping zones configuration (public read)
export const getShippingZones = async (_req: Request, res: Response) => {
  try {
    if (!isDbQueryable(Wilaya, "find")) {
      const zones = ALGERIAN_WILAYAS.map((w) => ({
        id: `wilaya-${String(w.code).padStart(2, "0")}`,
        code: w.code,
        name: w.name,
        nameFr: w.nameFr,
        nameAr: w.nameAr,
        parentCode: w.parentCode ?? null,
        coverageStatus: w.defaultCoverageStatus,
        home: defaultShippingFee("home"),
        office: defaultShippingFee("office"),
      }));
      return res.json({ success: true, data: zones });
    }

    const wilayas = await Wilaya.find({ isActive: true })
      .sort({ code: 1, sortOrder: 1, name: 1 })
      .lean();

    const rates = isDbQueryable(ShippingRate, "find")
      ? await ShippingRate.find({ isActive: true }).lean()
      : [];
    const rateMap = new Map<string, { home?: number; office?: number }>();
    for (const r of rates as any[]) {
      const key = String(r.wilayaId);
      const entry = rateMap.get(key) || {};
      if (r.deliveryMethod === "home") entry.home = Number(r.price);
      if (r.deliveryMethod === "office") entry.office = Number(r.price);
      rateMap.set(key, entry);
    }

    const zones = wilayas.map((wilaya: any) => {
      const r = rateMap.get(String(wilaya._id)) || {};
      return {
        id: wilaya._id,
        code: wilaya.code,
        name: wilaya.name,
        nameFr: wilaya.nameFr,
        nameAr: wilaya.nameAr,
        parentCode: wilaya.parentCode ?? null,
        coverageStatus: wilaya.coverageStatus || "served",
        homeDeliverySupported: wilaya.homeDeliverySupported ?? true,
        officeDeliverySupported: wilaya.officeDeliverySupported ?? true,
        home: r.home ?? defaultShippingFee("home"),
        office: r.office ?? defaultShippingFee("office"),
      };
    });

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

// PUT /api/shipping/coverage/:wilayaRef - Update courier coverage & optional fees for a wilaya (admin)
export const updateWilayaCoverage = async (req: AuthRequest, res: Response) => {
  try {
    const { wilayaRef } = req.params;
    const {
      coverageStatus,
      homeDeliverySupported,
      officeDeliverySupported,
      coverageNoteAr,
      coverageNoteFr,
      homeFee,
      officeFee,
      isActive,
    } = req.body || {};

    if (coverageStatus !== undefined && !VALID_COVERAGE_STATUSES.has(coverageStatus)) {
      return res.status(400).json({
        message: "coverageStatus must be served, via_parent_wilaya, confirm_by_phone, or unserved",
      });
    }

    const refStr = String(Array.isArray(wilayaRef) ? wilayaRef[0] : wilayaRef || "");
    const canonical = findCanonicalWilaya(refStr);
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(refStr);
    if (!canonical && !isObjectId) {
      return res.status(404).json({ message: "Wilaya not found" });
    }

    let doc: any = isObjectId
      ? await Wilaya.findById(refStr)
      : await Wilaya.findOne({
          $or: [{ code: canonical!.code }, { name: canonical!.name }],
        });

    if (!doc && canonical) {
      doc = new Wilaya({
        code: canonical.code,
        name: canonical.name,
        nameFr: canonical.nameFr,
        nameAr: canonical.nameAr,
        aliases: canonical.aliases || [],
        reformYear: canonical.reformYear,
        parentCode: canonical.parentCode ?? null,
        parentName: canonical.parentName ?? null,
        coverageStatus: canonical.defaultCoverageStatus,
        homeDeliverySupported: canonical.defaultHomeDelivery,
        officeDeliverySupported: canonical.defaultOfficeDelivery,
        isActive: true,
        sortOrder: canonical.code,
      });
    }

    if (!doc) {
      return res.status(404).json({ message: "Wilaya not found" });
    }

    if (coverageStatus !== undefined) doc.coverageStatus = coverageStatus;
    if (typeof homeDeliverySupported === "boolean") doc.homeDeliverySupported = homeDeliverySupported;
    if (typeof officeDeliverySupported === "boolean") doc.officeDeliverySupported = officeDeliverySupported;
    if (typeof coverageNoteAr === "string") doc.coverageNoteAr = coverageNoteAr.trim().slice(0, 400);
    if (typeof coverageNoteFr === "string") doc.coverageNoteFr = coverageNoteFr.trim().slice(0, 400);
    if (typeof isActive === "boolean") doc.isActive = isActive;

    await doc.save();

    if (homeFee !== undefined && homeFee !== null && homeFee !== "") {
      const parsedHome = Number(homeFee);
      if (!Number.isFinite(parsedHome) || parsedHome < 0 || parsedHome > 100000) {
        return res.status(400).json({ message: "homeFee must be between 0 and 100000" });
      }
      await ShippingRate.findOneAndUpdate(
        { wilayaId: doc._id, deliveryMethod: "home" },
        { price: parsedHome, isActive: true },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
    }

    if (officeFee !== undefined && officeFee !== null && officeFee !== "") {
      const parsedOffice = Number(officeFee);
      if (!Number.isFinite(parsedOffice) || parsedOffice < 0 || parsedOffice > 100000) {
        return res.status(400).json({ message: "officeFee must be between 0 and 100000" });
      }
      await ShippingRate.findOneAndUpdate(
        { wilayaId: doc._id, deliveryMethod: "office" },
        { price: parsedOffice, isActive: true },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
    }

    await recordAuditLog(req, {
      action: "shipping.wilaya_coverage_updated",
      resourceType: "Wilaya",
      resourceId: String(doc._id),
      summary: `Updated courier coverage for wilaya ${doc.code ?? ""} ${doc.name} (${doc.coverageStatus})`,
    });

    res.json({ success: true, data: doc });
  } catch (error) {
    console.error("Update wilaya coverage error:", error);
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
  updateWilayaCoverage,
  deleteShippingRate,
};
