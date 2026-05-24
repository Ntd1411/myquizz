import { AppError } from "../../shared/errors/AppError.js";
import type { User } from "../../shared/types/shared.types.js";
import { userRepository } from "./user.repository.js";
import { sharedRepository } from "../../shared/repositories/shared.repository.js";
import { hashPassword, verifyPassword } from "../../shared/utils/auth.utils.js";

export async function getUserService(userId: number): Promise<User> {
  const user = await sharedRepository.findById(userId);
  if (!user) {
    throw new AppError(404, "User not found");
  }

  return user;
}

export async function changePasswordService(
  user: User,
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  if (!user.password) {
    throw new AppError(400, "User does not have a password set");
  }

  if (oldPassword === newPassword) {
    throw new AppError(
      400,
      "New password must be different from the old password",
    );
  }

  const isValid = await verifyPassword(oldPassword, user.password);

  if (!isValid) {
    throw new AppError(400, "Old password is incorrect");
  }

  const newPasswordHash = await hashPassword(newPassword);

  const isPasswordChanged = await userRepository.changePassword(
    user.id,
    newPasswordHash,
  );

  if (!isPasswordChanged) {
    throw new AppError(500, "Failed to change password");
  }
}
