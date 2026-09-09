import { Request, Response } from "express";
import crypto from "crypto";
import { User, Customer } from "../../Database/Models";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { validateAlgerianPhone } from "../../utils/orderNumber";
import { JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_SALT_ROUNDS } from "../config/env";

// --- Registration ---

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    
    // Validate email
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    
    // Validate phone if provided
    if (phone && !validateAlgerianPhone(phone)) {
      return res.status(400).json({ message: "Invalid Algerian phone number" });
    }
    
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

export const getCurrentUser = async (req: Request, res: Response) => {
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

export const updateProfile = async (req: Request, res: Response) => {
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

// In-memory reset token store. Tokens are opaque random hex, hashed at rest,
// time-bounded, single-use, and keyed by user id. For multi-instance prod use
// a shared store (Redis/DB) but the contract (hashed token + expiry) stays.
interface ResetTokenRecord {
  tokenHash: string;
  userId: string;
  expiresAt: number;
}
const resetTokens = new Map<string, ResetTokenRecord>();

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
    resetTokens.set(tokenHash, {
      tokenHash,
      userId: user._id.toString(),
      expiresAt: Date.now() + RESET_TOKEN_TTL_MS,
    });

    // No email service configured: include the token in the response so the
    // owner can test the flow. In production with SMTP, replace with a
    // sendEmail(...) call and remove the `devResetToken` field.
    res.json({
      success: true,
      message: "If an account with this email exists, a password reset link has been sent.",
      devResetToken: rawToken,
    });
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
    const record = resetTokens.get(tokenHash);

    if (!record) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }
    if (record.expiresAt < Date.now()) {
      resetTokens.delete(tokenHash);
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const user = await User.findById(record.userId);
    if (!user) {
      resetTokens.delete(tokenHash);
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const saltRounds = parseInt(BCRYPT_SALT_ROUNDS) || 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    user.password = hashedPassword;
    await user.save();

    // Single-use: delete token so it cannot be replayed
    resetTokens.delete(tokenHash);

    res.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Server error" });
  }
};