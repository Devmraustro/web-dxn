import { Router, Request, Response } from "express";
import {
  getPacks,
  getPackById,
  createPack,
  updatePack,
  deletePack,
  togglePackFeatured,
  getPackItems,
} from "../controllers/pack.controller";
import { validateRequest } from "../middleware/validateRequest.middleware";
import { packSchema, packUpdateSchema } from "../middleware/validationSchema";
import { authenticate, adminOnly } from "../middleware/auth.middleware";

const router = Router();

// Public read endpoints
router.get("/", getPacks);
router.get("/:id", getPackById);
router.get("/:id/items", getPackItems);

// All write operations require authenticated admin/owner
router.post(
  "/",
  authenticate,
  adminOnly,
  validateRequest(packSchema),
  createPack
);
router.put(
  "/:id",
  authenticate,
  adminOnly,
  validateRequest(packUpdateSchema),
  updatePack
);
router.delete("/:id", authenticate, adminOnly, deletePack);
router.patch("/:id/toggle-featured", authenticate, adminOnly, togglePackFeatured);

export default router;