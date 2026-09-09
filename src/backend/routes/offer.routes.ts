import { Router, Request, Response } from "express";
import {
  getOffers,
  getOfferById,
  createOffer,
  updateOffer,
  deleteOffer,
  toggleOfferFeatured,
} from "../controllers/offer.controller";
import { authenticate, adminOnly } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validateRequest.middleware";
import { offerCreateSchema, offerUpdateSchema } from "../middleware/validationSchema";

const router = Router();

// Public read endpoints
router.get("/", getOffers);
router.get("/:id", getOfferById);

// All write operations require authenticated admin/owner
router.post("/", authenticate, adminOnly, validateRequest(offerCreateSchema), createOffer);
router.put("/:id", authenticate, adminOnly, validateRequest(offerUpdateSchema), updateOffer);
router.delete("/:id", authenticate, adminOnly, deleteOffer);
router.patch("/:id/toggle-featured", authenticate, adminOnly, toggleOfferFeatured);

export default router;