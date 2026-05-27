import type { Response, NextFunction } from "express";
import { verifyToken } from "../../shared/utils/auth.utils.js";
import { AppError } from "../../shared/errors/AppError.js";
import { sharedRepository } from "../../shared/repositories/shared.repository.js";
import { type AuthRequest } from "../../shared/types/shared.types.js";

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError(401, "Authorization header missing or malformed");
  }

  const token = authHeader.substring(7);

  // Check if token is blacklisted
  const isBlacklisted = await sharedRepository.isTokenBlacklisted(token);

  if (isBlacklisted) {
    throw new AppError(401, "Token is blacklisted");
  }

  const decoded = verifyToken(token, "access");

  if (!decoded || decoded.type !== "access" || !decoded.userId) {
    throw new AppError(401, "Invalid access token");
  }

  const user = await sharedRepository.findById(decoded.userId);

  if (!user) {
    throw new AppError(401, "Invalid access token");
  }

  if (user.deleted_at !== null) {
    throw new AppError(403, "Account is deactivated");
  }

  req.token = token;
  req.user = user;
  next();
}
