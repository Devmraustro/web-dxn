import { Router, Request, Response } from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleFeatured,
} from "../controllers/product.controller";
import { validateRequest } from "../middleware/validateRequest.middleware";
import { productSchema, productUpdateSchema } from "../middleware/validationSchema";
import { authenticate, adminOnly } from "../middleware/auth.middleware";

const router = Router();

// GET /api/products - Get all products with filtering (public)
router.get("/", getProducts);

// GET /api/products/:id - Get single product (public)
router.get("/:id", getProductById);

// All write operations require authenticated admin/owner
router.post(
  "/",
  authenticate,
  adminOnly,
  validateRequest(productSchema),
  createProduct
);

router.put(
  "/:id",
  authenticate,
  adminOnly,
  validateRequest(productUpdateSchema),
  updateProduct
);

router.delete("/:id", authenticate, adminOnly, deleteProduct);

router.patch("/:id/toggle-featured", authenticate, adminOnly, toggleFeatured);

export default router;