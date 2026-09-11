import { Router, Request, Response } from "express";
import {
  createReview,
  getProductReviews,
  getAllReviews,
  getAllReviewsAdmin,
  updateReview,
  deleteReview,
} from "../controllers/review.controller";
import { authenticate, adminOnly } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validateRequest.middleware";
import { reviewCreateSchema, reviewUpdateSchema } from "../middleware/validationSchema";

const router = Router();

// Public read endpoints
router.get("/", getAllReviews);
router.get("/all", authenticate, adminOnly, getAllReviewsAdmin);
router.get("/product/:productId", getProductReviews);

// Admin-only creation
router.post("/", authenticate, adminOnly, validateRequest(reviewCreateSchema), createReview);

// Admin-only update and delete
router.put("/:id", authenticate, adminOnly, validateRequest(reviewUpdateSchema), updateReview);
router.delete("/:id", authenticate, adminOnly, deleteReview);

export default router;
