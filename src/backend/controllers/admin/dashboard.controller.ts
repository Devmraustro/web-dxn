import { Request, Response } from "express";
import { Order, Product, Pack, Offer, Customer, Wilaya, ShippingRate } from "../../../Database/Models";

// GET /api/admin/dashboard/stats
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    // Today's date range
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    
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
    const revenuePipeline = [
      { $match: { status: "delivered" } },
      { $group: { _id: null, totalRevenue: { $sum: "$total" } } }
    ];
    const revenueResult = await Order.aggregate(revenuePipeline);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;
    
    // Order count by status
    const orderStatusCounts = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    
    const statusBreakdown: any = {};
    orderStatusCounts.forEach((item: any) => {
      statusBreakdown[item._id] = item.count;
    });
    
    // Recent orders
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("customerId", "firstName lastName")
      .lean();
    
    // Top products
    const topProducts = await Order.aggregate([
      { $unwind: "$items" },
      { $group: { _id: "$items.productId", totalSold: { $sum: "$items.quantity" }, revenue: { $sum: "$items.totalPrice" } } },
      { $sort: { totalSold: -1 } },
      { $limit: 5 },
      { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } }
    ]);
    
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
    const limit = parseInt(req.query.limit as string) || 10;
    
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

// GET /api/admin/dashboard/revenue
export const getRevenueStats = async (req: Request, res: Response) => {
  try {
    const { period = "monthly" } = req.query;
    
    const now = new Date();
    let startDate;
    
    if (period === "daily") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === "weekly") {
      const day = now.getDay();
      startDate = new Date(now.setDate(now.getDate() - day));
    } else { // monthly
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    const revenue = await Order.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: "delivered" } },
      { $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
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
    const limit = parseInt(req.query.limit as string) || 10;
    
    const topProducts = await Order.aggregate([
      { $unwind: "$items" },
      { $group: {
          _id: "$items.productId",
          totalSold: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.totalPrice" }
        }
      },
      { $sort: { totalSold: -1 } },
      { $limit: limit },
      { $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" }
    ]);
    
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
    const limit = parseInt(req.query.limit as string) || 10;
    
    const topWilayas = await Order.aggregate([
      { $group: {
          _id: "$customerInfo.wilaya",
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: "$total" }
        }
      },
      { $sort: { orderCount: -1 } },
      { $limit: limit },
      { $lookup: {
          from: "wilayas",
          localField: "_id",
          foreignField: "name",
          as: "wilayaInfo"
        }
      }
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