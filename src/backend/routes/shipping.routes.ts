import { Router, Request, Response } from "express";
import {
  getWilayas,
  getShippingRate,
  calculateShipping,
  getShippingZones,
} from "../controllers/shipping.controller";
import { validateRequest } from "../middleware/validateRequest.middleware";
import { wilayaSchema } from "../middleware/validationSchema";
import { authenticate, adminOnly } from "../middleware/auth.middleware";

const router = Router();

// Public shipping endpoints
router.get("/wilayas", getWilayas);
router.get("/rate", getShippingRate);
router.post("/calculate", calculateShipping);
router.get("/zones", getShippingZones);

export default router;