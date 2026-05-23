import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../../shared/types/shared.types.js";
import { getMeService } from "./user.services.js";

export async function getMe(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.userId;

    const user = await getMeService(String(userId));

    const { password, ...userWithoutPassword } = user || {};

    res.json(userWithoutPassword);
  } catch (error) {
    next(error);
  }
}

export async function getUserById(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {}

export async function changePassword(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {}

export async function uploadAvatar(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {}

export async function updateProfile(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {}

export async function deleteAccount(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {}
