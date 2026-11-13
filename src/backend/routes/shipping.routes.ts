import { Router } from "express";
import {
  getWilayas,
  getShippingRate,
  calculateShipping,
  getShippingZones,
  setupShippingRate,
  updateWilayaCoverage,
  deleteShippingRate,
} from "../controllers/shipping.controller";
import { authenticate, adminOnly } from "../middleware/auth.middleware";

const router = Router();

// Public read endpoints (checkout + shipping info)
router.get("/wilayas", getWilayas);
router.get("/rates", getShippingRate);
router.get("/calculate", calculateShipping);
router.post("/calculate", calculateShipping);
router.get("/zones", getShippingZones);

// Admin-only management of shipping rates & courier coverage
router.post("/setup", authenticate, adminOnly, setupShippingRate);
router.put("/coverage/:wilayaRef", authenticate, adminOnly, updateWilayaCoverage);
router.delete("/rate/:wilayaId/:deliveryMethod", authenticate, adminOnly, deleteShippingRate);

export default router;
