import { Router, Request, Response } from "express";
import {
  registerUser,
  loginUser,
  getCurrentUser,
  updateProfile,
  forgotPassword,
  resetPassword,
} from "../controllers/user.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validateRequest.middleware";
import { authRateLimiter } from "../middleware/security.middleware";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "../middleware/validationSchema";

const router = Router();

// Public authentication endpoints are rate-limited (brute-force protection).
router.post("/register", authRateLimiter, validateRequest(registerSchema), registerUser);
router.post("/login", authRateLimiter, validateRequest(loginSchema), loginUser);
router.post("/forgot-password", authRateLimiter, validateRequest(forgotPasswordSchema), forgotPassword);
router.post("/reset-password/:token", authRateLimiter, validateRequest(resetPasswordSchema), resetPassword);

// Authenticated profile endpoints
router.get("/me", authenticate, getCurrentUser);
router.put("/profile", authenticate, validateRequest(updateProfileSchema), updateProfile);

export default router;
