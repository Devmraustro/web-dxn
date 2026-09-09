import { Router, Request, Response } from "express";
import {
  getDashboardStats,
  getRecentOrders,
  getRevenueStats,
  getTopProducts,
  getTopWilayas,
} from "../controllers/admin/dashboard.controller";
import { authenticate, adminOnly } from "../middleware/auth.middleware";

const router = Router();

// All admin routes require authenticated admin/owner
router.use(authenticate);
router.use(adminOnly);

// Dashboard
router.get("/dashboard/stats", getDashboardStats);
router.get("/dashboard/recent-orders", getRecentOrders);
router.get("/dashboard/revenue", getRevenueStats);
router.get("/dashboard/top-products", getTopProducts);
router.get("/dashboard/top-wilayas", getTopWilayas);

export default router;