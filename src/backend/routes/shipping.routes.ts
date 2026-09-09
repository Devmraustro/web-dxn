import { Router } from "express";
import {
  getWilayas,
  getShippingRate,
  calculateShipping,
  getShippingZones,
  setupShippingRate,
  deleteShippingRate,
} from "../controllers/shipping.controller";
import { authenticate, adminOnly } from "../middleware/auth.middleware";

const router = Router();

// Public shipping endpoints
router.get("/wilayas", getWilayas);
router.get("/rate", getShippingRate);
router.get("/calculate", calculateShipping); // used by the checkout form
router.post("/calculate", calculateShipping); // API-client equivalent
router.get("/zones", getShippingZones);

// Admin-only management of shipping rates
router.post("/setup", authenticate, adminOnly, setupShippingRate);
router.delete("/rate/:wilayaId/:deliveryMethod", authenticate, adminOnly, deleteShippingRate);

export default router;
