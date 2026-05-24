import { Router } from "express";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";
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
  updateProfileSchema,
} from "../../shared/validators/schemas.js";

export const userRouter = Router();

userRouter.get("/me", authMiddleware, getMe);
userRouter.get("/:userId", getUser);
userRouter.patch(
  "/password",
  authMiddleware,
  validate(changePasswordSchema),
  changePassword,
);
userRouter.patch("/avatar", authMiddleware, uploadAvatar);
userRouter.patch(
  "/profile",
  authMiddleware,
  validate(updateProfileSchema),
  updateProfile,
);
userRouter.delete("/account", authMiddleware, deleteAccount);
