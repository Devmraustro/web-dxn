import { Request, Response } from "express";
import crypto from "crypto";
import { User, Customer } from "../../Database/Models";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_SALT_ROUNDS } from "../config/env";
import type { AuthRequest } from "../middleware/auth.middleware";

// --- Registration ---

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    
    // Validate email
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    
    // Phone validity is enforced by the register schema (validateRequest) which
    // accepts all Algerian mobile prefixes 05/06/07; no duplicated check here.
    
    // Hash password
    const saltRounds = parseInt(BCRYPT_SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Determine role - PUBLIC REGISTRATION IS ALWAYS STAFF.
    // Never accept role from request body. Owner accounts must be provisioned
    // out-of-band (seed script, admin console, or DB migration). This prevents
    // privilege escalation via the public /register endpoint.
    const userRole = "staff";
    
    // Create user
    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      role: userRole,
      name: `${firstName} ${lastName}`,
      phone,
    });
    
    await user.save();
    
    // Create customer profile
    const customer = new Customer({
      userId: user._id,
      firstName,
      lastName,
      phone,
      wilaya: "", // Will be set later during checkout
      commune: "",
      address: "",
    });
    
    await customer.save();
    
    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          name: user.name,
        },
        customer: {
          id: customer._id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone,
        },
      },
    });
  } catch (error: unknown) {
    console.error("Register user error:", error);
    
    // Handle duplicate key error
    if (typeof error === "object" && error !== null && (error as { code?: number }).code === 11000) {
      return res.status(409).json({ message: "Email already exists" });
    }
    
    res.status(500).json({ message: "Server error" });
  }
};

// --- Login ---

export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    
    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
    );
    
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          name: user.name,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// --- Get current user ---

export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user?.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// --- Update profile ---

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { firstName, lastName, phone, secondPhone, wilaya, commune, address } = req.body;
    
    // Update customer
    await Customer.findOneAndUpdate(
      { userId: req.user?.userId },
      { 
        firstName,
        lastName,
        phone,
        secondPhone,
        wilaya,
        commune,
        address,
      },
      { new: true, upsert: true }
    );
    
    // Update user name
    await User.findByIdAndUpdate(
      req.user?.userId,
      { name: `${firstName} ${lastName}` },
      { new: true }
    );
    
    res.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// --- Forgot password ---

// Reset tokens are stored per-user in MongoDB as a SHA-256 hash + expiry:
//   - multi-instance / serverless safe (no per-instance memory store)
//   - single-use (cleared after a successful reset)
//   - opaque (raw token is never persisted and never logged)
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if email exists or not (avoid user enumeration)
      return res.json({
        success: true,
        message: "If an account with this email exists, a password reset link has been sent.",
      });
    }

    // Generate a random opaque token, store only its hash, set TTL.
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      }
    );

    // NO SMTP is configured in this build. Returning the raw token in the
    // response body would let anyone who knows an email address take over the
    // account, so it is only echoed in non-production environments for local
    // testing. In production the owner must wire an SMTP sender (see
    // docs/DEPLOYMENT.md) so the token is delivered out-of-band; until then the
    // reset flow fails closed with a generic message.
    const response: Record<string, unknown> = {
      success: true,
      message: "If an account with this email exists, a password reset link has been sent.",
    };
    if (process.env.NODE_ENV !== "production") {
      response.devResetToken = rawToken;
    }
    res.json(response);
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// --- Reset password ---

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    const { password } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Reset token is required" });
    }
    if (!password) {
      return res.status(400).json({ message: "New password is required" });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const tokenHash = hashToken(token);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const saltRounds = parseInt(BCRYPT_SALT_ROUNDS) || 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Single-use: clear the token fields atomically with the new password so a
    // replayed token cannot be used twice.
    user.password = hashedPassword;
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Server error" });
  }
};