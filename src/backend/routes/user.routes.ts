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
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "../middleware/validationSchema";

const router = Router();

// POST /api/users/register - Register new user
router.post("/register", validateRequest(registerSchema), registerUser);

// POST /api/users/login - Login
router.post("/login", validateRequest(loginSchema), loginUser);

// GET /api/users/me - Get current user (authenticated)
router.get("/me", authenticate, getCurrentUser);

// PUT /api/users/profile - Update profile
router.put("/profile", authenticate, validateRequest(updateProfileSchema), updateProfile);

// POST /api/users/forgot-password - Forgot password
router.post("/forgot-password", validateRequest(forgotPasswordSchema), forgotPassword);

// POST /api/users/reset-password/:token - Reset password
router.post("/reset-password/:token", validateRequest(resetPasswordSchema), resetPassword);

export default router;