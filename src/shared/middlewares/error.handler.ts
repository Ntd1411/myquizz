import type { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError.js";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // console.error("Error:", err);

  // Xử lý AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  // Multer errors - PHẢI XỬ LÝ TRƯỚC validation errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res
      .status(413)
      .json({ error: "File too large. Maximum size is 20MB" });
  }
  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({ error: "Field name không hợp lệ" });
  }
  if (err.message?.includes("File type not supported")) {
    return res.status(400).json({ error: err.message });
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
