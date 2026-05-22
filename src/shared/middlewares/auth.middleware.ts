import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/auth.utils.js";
import { AppError } from "../errors/AppError.js";
import { sharedRepository } from "../repositories/shared.repository.js";
import { type AuthRequest} from '../types/shared.types.js'

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

  req.token = token;
  req.userId = decoded.userId;
  next();
}
