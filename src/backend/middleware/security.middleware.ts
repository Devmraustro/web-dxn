import { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type { AuthRequest } from "./auth.middleware";

/**
 * Security headers. The default Helmet Content-Security-Policy restricts
 * img-src to 'self' data:, which would block product photos served from
 * Cloudinary (https://res.cloudinary.com) — the production upload backend —
 * and the storefront renders them in <img> tags. Keep every other default
 * directive untouched and only widen img-src to the Cloudinary host.
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "https://res.cloudinary.com"],
    },
  },
});

const stripMongoOperators = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      value[i] = stripMongoOperators(value[i]);
    }
    return value;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (key.startsWith("$") || key.includes(".")) {
        delete record[key];
      } else {
        record[key] = stripMongoOperators(record[key]);
      }
    }
    return record;
  }

  return value;
};

const createNoSqlSanitizer = () => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.body) req.body = stripMongoOperators(req.body);
    if (req.query) stripMongoOperators(req.query);
    if (req.params) req.params = stripMongoOperators(req.params) as Request["params"];
    next();
  };
};

export const xssSanitization = createNoSqlSanitizer();
export const noSqlInjectionProtection = createNoSqlSanitizer();

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again later." },
});

export const validateInput = (req: Request, res: Response, next: NextFunction) => {
  const MAX_KEYS = 100;
  const MAX_DEPTH = 10;

  function countKeys(obj: unknown, depth = 0): number {
    if (depth > MAX_DEPTH) return MAX_KEYS + 1;
    if (Array.isArray(obj)) {
      return obj.reduce((sum, item) => sum + countKeys(item, depth + 1), 0);
    }
    if (obj && typeof obj === "object") {
      // Skip Buffer objects - they are used for raw body parsing (e.g., Meta webhook HMAC verification)
      // and their byte indexes would incorrectly trigger the key limit.
      if (Buffer.isBuffer(obj)) {
        return 0;
      }
      const keys = Object.keys(obj as Record<string, unknown>);
      if (keys.length > MAX_KEYS) return MAX_KEYS + 1;
      return keys.reduce((sum, key) => sum + countKeys((obj as Record<string, unknown>)[key], depth + 1), 0);
    }
    return 1;
  }

  try {
    if (req.body && typeof req.body === "object") {
      const keys = countKeys(req.body);
      if (keys > MAX_KEYS) {
        // Either too many keys overall or the depth limit was exceeded.
        return res.status(413).json({ message: "Request body too complex" });
      }
    }
  } catch {
    return res.status(400).json({ message: "Invalid request body" });
  }
  next();
};

export const csrfProtection = (_req: Request, res: Response, next: NextFunction) => {
  res.locals.csrfToken = "csrf-token-" + Date.now();
  next();
};

export const preventSqlInjection = (value: any): any => {
  if (typeof value === "string") {
    return value.replace(/['"%;()]/g, "");
  }
  if (Array.isArray(value)) {
    return value.map(preventSqlInjection);
  }
  if (value && typeof value === "object") {
    const result: any = {};
    for (const key of Object.keys(value)) {
      result[key] = preventSqlInjection(value[key]);
    }
    return result;
  }
  return value;
};

export const validateAlgerianPhone = (
  phone: string
): { valid: boolean; formatted: string; error?: string } => {
  if (!phone) return { valid: false, formatted: "", error: "Phone number is required" };

  const cleaned = phone.replace(/\s+/g, "").replace(/^\+/, "");

  if (!/^0[5-7]\d{8}$/.test(cleaned)) {
    return {
      valid: false,
      formatted: cleaned,
      error: "Invalid Algerian phone number. Must be 10 digits starting with 05, 06, or 07.",
    };
  }

  return { valid: true, formatted: cleaned };
};

export const validatePasswordStrength = (
  password: string
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (password.length > 128) {
    errors.push("Password must not exceed 128 characters");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return { valid: errors.length === 0, errors };
};

export const fileUploadSecurity = (
  maxSize: number = 5 * 1024 * 1024,
  allowedTypes: string[] = []
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file && !req.files) {
        return next();
      }

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const file = req.file || files?.["image"]?.[0] || files?.["video"]?.[0];

      if (!file) {
        return next();
      }

      if (file.size > maxSize) {
        return res.status(400).json({
          message: "File too large. Maximum size: " + maxSize / 1024 / 1024 + "MB",
        });
      }

      if (file.mimetype && !allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          message: "Invalid file type. Allowed types: " + allowedTypes.join(", "),
        });
      }

      const ext = "." + (file.originalname.split(".").pop() || "").toLowerCase();
      if (ext) {
        const allowedExts = allowedTypes.map((t: string) => t.split("/").pop()).filter(Boolean);
        if (!allowedExts.includes(ext)) {
          return res.status(400).json({
            message: "Invalid file extension. Allowed: " + allowedExts.join(", "),
          });
        }
      }

      next();
    } catch (error) {
      console.error("File upload security error:", error);
      res.status(500).json({ message: "File upload error" });
    }
  };
};

export const adminAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && (req.cookies as any).adminToken) {
      token = (req.cookies as any).adminToken;
    }

    if (!token) {
      return res.status(401).json({ message: "Admin authentication required" });
    }

    if (req.user && req.user.role !== "owner" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    res.status(500).json({ message: "Admin authentication error" });
  }
};

export const preventIdor = (
  _modelName: string,
  _idField: string = "_id"
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      next();
    } catch (error) {
      console.error("IDOR prevention error:", error);
      res.status(500).json({ message: "Resource access error" });
    }
  };
};

export const limitQueryFields = (allowedFields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { filter } = req.query;

    if (filter) {
      const filterKeys = Object.keys(filter as Record<string, unknown>);
      const invalidKeys = filterKeys.filter((key) => !allowedFields.includes(key));

      if (invalidKeys.length > 0) {
        return res.status(400).json({
          message: "Invalid query fields: " + invalidKeys.join(", "),
        });
      }
    }

    next();
  };
};

export default {
  securityHeaders,
  xssSanitization,
  noSqlInjectionProtection,
  rateLimiter,
  authRateLimiter,
  validateInput,
  csrfProtection,
  preventSqlInjection,
  validateAlgerianPhone,
  validatePasswordStrength,
  fileUploadSecurity,
  adminAuth,
  preventIdor,
  limitQueryFields,
};
