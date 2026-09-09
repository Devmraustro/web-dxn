import { NextFunction, Request, Response } from "express";
import logger from "../../utils/logger";

/**
 * Central error handler.
 *
 * Production responses never expose stack traces, file paths, database URLs
 * or internal error strings. 4xx validation-style errors (including multer
 * upload rejections and mongoose cast/validation errors) return a safe generic
 * message; anything else returns a plain 500.
 */
export const errorMiddleware = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const isProd = process.env.NODE_ENV === "production";

  // Always log full details server-side (never echoed to the client).
  logger.error(err?.stack || String(err?.message || "Internal Server Error"));

  // Multer file-upload rejections (size / mime / magic bytes / empty file).
  if (err?.name === "MulterError" || (err?.message && /upload|file/i.test(String(err.message)))) {
    return res.status(400).json({ message: "Invalid file upload" });
  }

  // Mongoose validation / malformed id / duplicate key.
  const name = err?.name || "";
  if (name === "ValidationError") {
    return res.status(400).json({ message: "Invalid data" });
  }
  if (name === "CastError" || /Cast to ObjectId/.test(String(err?.message || ""))) {
    return res.status(400).json({ message: "Invalid identifier format" });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ message: "Resource already exists" });
  }

  const statusCode = Number(err?.statusCode) >= 400 ? Number(err.statusCode) : 500;
  if (isProd && statusCode >= 500) {
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }

  res.status(statusCode).json({
    success: false,
    error: err?.message || "Internal Server Error",
    ...(isProd ? {} : { stack: err?.stack }),
  });
};

export default errorMiddleware;
