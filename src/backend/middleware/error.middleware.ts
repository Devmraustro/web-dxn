import { NextFunction, Request, Response } from "express";
import logger from "../../utils/logger";

export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error(err?.stack || String(err?.message || "Internal Server Error"));

  const statusCode = err?.statusCode || 500;
  const message = err?.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err?.stack }),
  });
};

export default errorMiddleware;