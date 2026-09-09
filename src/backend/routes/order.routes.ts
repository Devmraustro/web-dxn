import { Router, Request, Response } from "express";
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
} from "../controllers/order.controller";
import { validateStock } from "../middleware/inventory.middleware";
import { validateOrderPricing } from "../middleware/inventory.middleware";
import { idempotencyMiddleware } from "../middleware/inventory.middleware";
import { authenticate, adminOnly } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validateRequest.middleware";
import { orderCreateSchema, orderStatusUpdateSchema } from "../middleware/validationSchema";

const router = Router();

// GET /api/orders - Get orders with filtering (admin)
router.get("/", authenticate, adminOnly, getOrders);

// GET /api/orders/:id - Get single order (admin or order owner)
router.get("/:id", authenticate, getOrderById);

// POST /api/orders - Create new order (checkout - public, guest-friendly)
// Apply: idempotency key, stock validation, pricing validation
router.post(
  "/",
  idempotencyMiddleware("Idempotency-Key"),
  validateStock,
  validateOrderPricing,
  validateRequest(orderCreateSchema),
  createOrder
);

// PUT /api/orders/:id/status - Update order status (admin)
router.put(
  "/:id/status",
  authenticate,
  adminOnly,
  validateRequest(orderStatusUpdateSchema),
  updateOrderStatus
);

export default router;