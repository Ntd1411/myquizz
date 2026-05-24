import type { Response, NextFunction } from "express";
import type { AuthRequest, User } from "../../shared/types/shared.types.js";
import {
  changePasswordService,
  deleteAccountService,
  getUserService,
  updateProfileService,
} from "./user.services.js";
import { AppError } from "../../shared/errors/AppError.js";

export async function getMe(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const { password, ...userWithoutPassword } = req.user as User;

    res.json(userWithoutPassword);
  } catch (error) {
    next(error);
  }
}

export async function getUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = Number(req.params.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AppError(400, "Invalid user ID");
    }

    const user = await getUserService(userId);

    const userData = {
      id: user.id,
      fullname: user.fullname,
      email: user.email,
      avatar: user.avatar,
      description: user.description,
    };

    res.json(userData);
  } catch (error) {
    next(error);
  }
}

export async function changePassword(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user as User;
    const { oldPassword, newPassword } = req.body;

    await changePasswordService(user, oldPassword, newPassword);

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    next(error);
  }
}

export async function uploadAvatar(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {}

export async function updateProfile(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.user?.id as number;
    const { fullname, email, phone, description } = req.body;

    await updateProfileService(userId, fullname, email, phone, description);

    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    next(error);
  }
}

export async function deleteAccount(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const user = req.user as User;
    const { password } = req.body;

    await deleteAccountService(user, password);

    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    next(error);
  }
}
