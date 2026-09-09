import { NextFunction, Request, Response } from "express";
import * as yup from "yup";

export const validateRequest = (schema: yup.AnySchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.validate(req.body, { abortEarly: false });
      next();
    } catch (err) {
      if (err instanceof yup.ValidationError) {
        res.status(400).json({ message: "Validation failed", details: err.errors });
        return;
      }
      next(err);
    }
  };
};