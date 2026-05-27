import { Router } from "express";
import { authMiddleware } from "../auth/auth.middleware.js";
import {
  changePassword,
  deleteAccount,
  getMe,
  getUser,
  updateProfile,
  uploadAvatar,
} from "./user.controller.js";
import { validate } from "../../shared/validators/validator.js";
import {
  changePasswordSchema,
  deleteAccountSchema,
  updateProfileSchema,
} from "../../shared/validators/schemas.js";
import { uploadMiddleware } from "../../infrastructure/config/multer.config.js";

export const userRouter = Router();

userRouter.get("/me", authMiddleware, getMe);
userRouter.get("/:userId", getUser);
userRouter.patch(
  "/password",
  authMiddleware,
  validate(changePasswordSchema),
  changePassword,
);
userRouter.post(
  "/avatar",
  authMiddleware,
  uploadMiddleware.single("avatar"),
  uploadAvatar,
);
userRouter.patch(
  "/profile",
  authMiddleware,
  validate(updateProfileSchema),
  updateProfile,
);
userRouter.delete(
  "/account",
  authMiddleware,
  validate(deleteAccountSchema),
  deleteAccount,
);
