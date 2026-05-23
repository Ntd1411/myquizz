import { AppError } from "../../shared/errors/AppError.js";
import type { User } from "../../shared/types/shared.types.js";
import { userRepository } from "./user.repository.js";

export async function getMeService(userId: string): Promise<User> {
  const user = await userRepository.getUserById(userId);
  if (!user) {
    throw new AppError(404, "User not found");
  }

  return user;
}
