import { Router, Request, Response } from "express";
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
} from "../controllers/order.controller";
import { validateStock } from "../middleware/inventory.middleware";
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
// Pipeline (in execution order):
//   1. idempotencyMiddleware — a retry carrying an Idempotency-Key that already
//      produced an order short-circuits to the stored order BEFORE validation,
//      so a network-level retry (possibly with an altered body) still receives
//      the original result.
//   2. validateRequest — shape/type validation of the untrusted payload
//   3. validateStock — pre-flight stock availability read
//   4. createOrder — authoritative prices/shipping/discounts + atomic stock
// Client-supplied totals are NEVER used to price the order.
router.post(
  "/",
  idempotencyMiddleware("Idempotency-Key"),
  validateRequest(orderCreateSchema),
  validateStock,
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