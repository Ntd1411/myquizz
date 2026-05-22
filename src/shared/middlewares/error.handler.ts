import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError.js";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.error("Error:", err);

  // Xử lý AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  // Validation errors (Zod/Joi)
  if (err.isJoi || err.errors) {
    return res.status(400).json({ error: err.message });
  }

  // Database errors
  if (err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT") {
    return res.status(503).json({ error: "Service unavailable" });
  }

  // Default error
  return res.status(500).json({ error: "Internal server error" });
}
