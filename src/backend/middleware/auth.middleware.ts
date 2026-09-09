import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import type { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from "../config/env";

export interface AuthRequest extends Request {
  user?: JwtPayload & { role?: string; userId?: string } & Record<string, any>;
}

const getRole = (user: any): string => (user && typeof user === "object" ? user.role || "" : "");

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    let token: string | undefined;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    // Check for token in cookie
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({ message: "Authentication required - no token provided" });
      return;
    }

    // Verify token using the validated JWT_SECRET (throws in production if unset)
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user to request
    req.user = typeof decoded === "string" ? { sub: decoded } : (decoded as JwtPayload);
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Optional: role-based authentication
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const role = getRole(req.user);
    if (!role || !roles.includes(role)) {
      res.status(403).json({ message: "Insufficient permissions" });
      return;
    }
    next();
  };
};

// Admin role guard
export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user) {
    // Attach the userId to the token for downstream access to current user data
    if (!req.user.userId && req.user.id) {
      req.user.userId = req.user.id;
    }
  }
  const role = getRole(req.user);
  if (role !== "owner" && role !== "admin") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
};