import { AppError } from "../../shared/errors/AppError.js";
import type { User } from "../../shared/types/shared.types.js";
import { userRepository } from "./user.repository.js";
import { sharedRepository } from "../../shared/repositories/shared.repository.js";
import { hashPassword, verifyPassword } from "../../shared/utils/auth.utils.js";
import { storageService } from "../../infrastructure/storage/storage.service.js";

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

export async function uploadAvatarService(
  userId: number,
  avatarUrl: string,
): Promise<void> {
  const isAvatarUploaded = await userRepository.uploadAvatar(userId, avatarUrl);

  if (!isAvatarUploaded) {
    throw new AppError(500, "Failed to upload avatar");
  }
}

export async function updateProfileService(
  userId: number,
  fullname?: string,
  email?: string,
  phone?: string,
  description?: string,
): Promise<void> {
  const updates: Record<string, string> = {};

  if (fullname) updates.fullname = fullname;
  if (email) {
    const user = await sharedRepository.findByEmail(email);
    if (user) {
      throw new AppError(400, "Email is already in use");
    }
    updates.email = email;
  }
  if (phone) {
    const user = await sharedRepository.findByPhone(phone);
    if (user) {
      throw new AppError(400, "Phone number is already in use");
    }
    updates.phone = phone;
  }
  if (description) updates.description = description;

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, "No fields to update");
  }

  const isProfileUpdated = await userRepository.updateProfile(userId, updates);

  if (!isProfileUpdated) {
    throw new AppError(500, "Failed to update profile");
  }
}

export async function deactivateAccountService(
  user: User,
  password: string,
): Promise<void> {
  const isPasswordCorrect = await verifyPassword(password, user.password);

  if (!isPasswordCorrect) {
    throw new AppError(403, "Invalid credentials");
  }

  const isDeactivated = await userRepository.deactivate(user.id);

  if (!isDeactivated) {
    throw new AppError(500, "Failed to deactivate account");
  }
}
