import "express";

declare global {
  namespace Express {
    interface Request {
      user?: any;
      session?: { csrfToken?: string; [key: string]: any } | null;
      cookies?: Record<string, any>;
      file?: any;
      files?: any;
    }
  }
}

export {};