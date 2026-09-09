import { Request, Response } from "express";
import { Order, Product, Pack, ProductTranslation } from "../../../Database/Models";

/** Statuses whose orders never count toward revenue / sales analytics. */
const EXCLUDED_STATUSES = ["cancelled", "rejected"];

const toPositiveInt = (v: unknown, fallback: number, max: number): number => {
  const n = parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
};

/**
 * Revenue definition used across the dashboard:
 * an order counts when it is a REALIZED (delivered) order. COD is only paid at
 * delivery, and BaridiMob prepaid orders are only recognized once payment is
 * verified; combining those rules without a payment gateway integration is
 * speculative, so the dashboard reports delivered-order revenue. Cancelled and
 * rejected orders are always excluded.
 */
const REVENUE_MATCH: Record<string, unknown> = {
  status: "delivered",
};

/**
 * Sales-leader aggregation shared by /stats and /top-products:
 *  - only orders that were not cancelled/rejected are counted
 *  - each order line is grouped by product OR pack (pack lines have a null
 *    productId, so they used to collapse into a single bogus "null product"
 *    bucket — they now surface as kind: "pack")
 *  - the bilingual name snapshot stored on the line at creation time is kept.
 */
function salesAggregation(limit: number): Record<string, unknown>[] {
  return [
    { $match: { status: { $nin: EXCLUDED_STATUSES } } },
    { $unwind: "$items" },
    // Skip malformed legacy lines that reference neither a product nor a pack.
    {
      $match: {
        $or: [{ "items.productId": { $ne: null } }, { "items.packId": { $ne: null } }],
      },
    },
    {
      $group: {
        _id: { $ifNull: ["$items.productId", "$items.packId"] },
        kind: {
          $first: {
            $cond: [{ $ifNull: ["$items.productId", false] }, "product", "pack"],
          },
        },
        name: { $first: { $ifNull: ["$items.productName", "$items.packName"] } },
        totalSold: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.totalPrice" },
      },
    },
    { $sort: { totalSold: -1 } },
    { $limit: limit },
  ];
}

/** Best-effort current-catalog label for a sales row (falls back to snapshot). */
async function enrichSalesRows(rows: any[]): Promise<any[]> {
  if (rows.length === 0) return rows;
  const productIds = rows.filter((r: any) => r.kind === "product").map((r: any) => r._id);
  const packIds = rows.filter((r: any) => r.kind === "pack").map((r: any) => r._id);

  const [products, packs, trs] = await Promise.all([
    productIds.length
      ? Product.find({ _id: { $in: productIds } }).select("sku").lean()
      : Promise.resolve([]),
    packIds.length ? Pack.find({ _id: { $in: packIds } }).select("name").lean() : Promise.resolve([]),
    productIds.length
      ? ProductTranslation.find({ productId: { $in: productIds }, language: { $in: ["ar", "fr"] } })
          .select("productId language title")
          .lean()
      : Promise.resolve([]),
  ]);

  const skuById = new Map((products as any[]).map((p: any) => [String(p._id), p.sku]));
  const trById = new Map<string, string>();
  for (const t of trs as any[]) {
    const pid = String(t.productId);
    if (!t.title) continue;
    if (t.language === "ar" || !trById.has(pid)) trById.set(pid, t.title);
  }
  const packNameById = new Map((packs as any[]).map((p: any) => [String(p._id), p.name]));

  return rows.map((r: any) => {
    const id = String(r._id);
    if (r.kind === "product") {
      return { ...r, name: r.name || trById.get(id) || skuById.get(id) || id };
    }
    return { ...r, name: r.name || packNameById.get(id) || id };
  });
}

// GET /api/admin/dashboard/stats
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    // Today's date range
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Total orders
    const totalOrders = await Order.countDocuments();

    // New orders (today)
    const newOrdersToday = await Order.countDocuments({
      createdAt: { $gte: todayStart },
    });

    // Pending payment orders
    const pendingPayment = await Order.countDocuments({
      status: "pending_payment",
    });

    // Confirmed orders
    const confirmed = await Order.countDocuments({
      status: "confirmed",
    });

    // Delivered orders
    const delivered = await Order.countDocuments({
      status: "delivered",
    });

    // Revenue from delivered orders
    const revenueResult = await Order.aggregate([
      { $match: REVENUE_MATCH },
      { $group: { _id: null, totalRevenue: { $sum: "$total" } } },
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    // Order count by status (admin overview: every status is visible here)
    const orderStatusCounts = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const statusBreakdown: Record<string, number> = {};
    orderStatusCounts.forEach((item: any) => {
      statusBreakdown[item._id] = item.count;
    });

    // Recent orders (every status — admins need to see cancellations too)
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("customerId", "firstName lastName")
      .lean();

    const topProducts = await enrichSalesRows(await Order.aggregate(salesAggregation(5)));

    res.json({
      success: true,
      data: {
        totalOrders,
        newOrdersToday,
        pendingPayment,
        confirmed,
        delivered,
        totalRevenue,
        statusBreakdown,
        recentOrders,
        topProducts,
      },
    });
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/admin/dashboard/recent-orders
export const getRecentOrders = async (req: Request, res: Response) => {
  try {
    const limit = toPositiveInt(req.query.limit, 10, 100);

    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("customerId", "firstName lastName phone")
      .lean();

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error("Get recent orders error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/admin/dashboard/revenue?period=daily|weekly|monthly&from=&to=
export const getRevenueStats = async (req: Request, res: Response) => {
  try {
    const periodRaw = String(req.query.period || "monthly");
    const period = periodRaw === "daily" || periodRaw === "weekly" ? periodRaw : "monthly";

    const now = new Date();
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (req.query.from) {
      const parsed = new Date(String(req.query.from));
      if (!Number.isNaN(parsed.getTime())) startDate = parsed;
    }
    if (req.query.to) {
      const parsed = new Date(String(req.query.to));
      if (!Number.isNaN(parsed.getTime())) endDate = parsed;
    }

    if (!startDate) {
      if (period === "daily") {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === "weekly") {
        const day = now.getDay();
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
    }

    // Revenue definition consistent with getDashboardStats: delivered orders
    // only (money actually received on COD / recognized as realized).
    const match: Record<string, unknown> = {
      ...REVENUE_MATCH,
      createdAt: {
        $gte: startDate,
        ...(endDate ? { $lte: endDate } : {}),
      },
    };

    // Bucket at the requested granularity: day for daily/weekly, month otherwise.
    const dayKey = {
      year: { $year: "$createdAt" },
      month: { $month: "$createdAt" },
      day: { $dayOfMonth: "$createdAt" },
    };
    const monthKey = { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } };
    const groupId = period === "daily" || period === "weekly" ? dayKey : monthKey;

    const revenue = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: groupId,
          revenue: { $sum: "$total" },
          orders: { $sum: 1 },
          itemsSold: { $sum: { $size: "$items" } },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    res.json({
      success: true,
      data: { period, revenue },
    });
  } catch (error) {
    console.error("Get revenue stats error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/admin/dashboard/top-products
export const getTopProducts = async (req: Request, res: Response) => {
  try {
    const limit = toPositiveInt(req.query.limit, 10, 100);
    const rows = await Order.aggregate(salesAggregation(limit));
    const topProducts = await enrichSalesRows(rows);

    res.json({
      success: true,
      data: topProducts,
    });
  } catch (error) {
    console.error("Get top products error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/admin/dashboard/top-wilayas
export const getTopWilayas = async (req: Request, res: Response) => {
  try {
    const limit = toPositiveInt(req.query.limit, 10, 100);

    const topWilayas = await Order.aggregate([
      { $match: { status: { $nin: EXCLUDED_STATUSES } } },
      {
        $group: {
          _id: "$customerInfo.wilaya",
          orderCount: { $sum: 1 },
          // Revenue counts delivered orders only, consistent with the rest of
          // the dashboard (COD is only paid at delivery).
          revenue: {
            $sum: { $cond: [{ $eq: ["$status", "delivered"] }, "$total", 0] },
          },
        },
      },
      { $sort: { orderCount: -1 } },
      { $limit: limit },
    ]);

    res.json({
      success: true,
      data: topWilayas,
    });
  } catch (error) {
    console.error("Get top wilayas error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export default {
  getDashboardStats,
  getRecentOrders,
  getRevenueStats,
  getTopProducts,
  getTopWilayas,
};
