import { Router, Request, Response } from "express";
import {
  getDashboardStats,
  getRecentOrders,
  getRevenueStats,
  getTopProducts,
  getTopWilayas,
} from "../controllers/admin/dashboard.controller";
import { getAdminCatalog, getAdminProductById } from "../controllers/admin/catalog.controller";
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

// Admin catalog — full catalogue view for owner/admin only (protected above by
// authenticate + adminOnly): exposes PLACEHOLDER/inactive seed records so they
// can be renamed, deactivated or cleaned up through the existing admin write
// endpoints. This route is NEVER public.
router.get("/catalog", getAdminCatalog);

// Admin single-product detail (full product + all translations, incl. inactive
// and placeholder records) for the admin product editor. NEVER public.
router.get("/products/:id", getAdminProductById);

export default router;