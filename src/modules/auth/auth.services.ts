import { env } from "../../infrastructure/config/envconfig.js";
import { authRepository } from "./auth.repository.js";
import ms from "ms";
import {
  generateTokens,
  hashPassword,
  verifyPassword,
  verifyToken,
  hashToken,
} from "../../shared/utils/auth.utils.js";
import { AppError } from "../../shared/errors/AppError.js";
import { sharedRepository } from "../../shared/repositories/shared.repository.js";

export async function registerService(
  email: string,
  password: string,
  fullname: string,
  phone?: string | null,
) {
  // Check if user email or phone already exists
  const existingUser = await authRepository.emailExists(email);
  const existingPhone = phone ? await authRepository.phoneExists(phone) : false;

  if (existingUser) {
    throw new AppError(409, "Email already registered");
  }

  if (existingPhone) {
    throw new AppError(409, "Phone number already registered");
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create user
  const user = await authRepository.addUser({
    email,
    password: hashedPassword,
    fullname,
    phone: phone || null,
  });

  const { password: _, ...userData } = user;

  return userData;
}

export async function loginService(
  email: string,
  password: string,
  deviceName: string,
  ipAddress: string,
) {
  // Find user by email
  const user = await sharedRepository.findByEmail(email);

  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  // Check if user is active
  if (user.deleted_at !== null) {
    throw new AppError(403, "Account is deactivated");
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password);

  if (!isValid) {
    throw new AppError(401, "Invalid email or password");
  }

  // Generate tokens
  const tokens = generateTokens(user.id);

  const hashedRefreshToken = await hashToken(tokens.refreshToken);

  await authRepository.saveRefreshToken(
    user.id,
    deviceName,
    ipAddress,
    hashedRefreshToken,
    new Date(Date.now() + ms(env.JWT_REFRESH_EXPIRES_IN as ms.StringValue)),
  );

  const { password: _, ...userData } = user;

  return { user: userData, ...tokens };
}

export async function refreshTokenService(refreshToken: string) {
  // Verify refresh token
  const decoded = verifyToken(refreshToken, "refresh");

  if (!decoded || decoded.type !== "refresh") {
    throw new AppError(401, "Invalid refresh token");
  }

  const user = await sharedRepository.findById(decoded.userId);
  if (!user) {
    throw new AppError(401, "User not found");
  }

  if (user.deleted_at !== null) {
    throw new AppError(403, "Account is deactivated");
  }

  const hashedRefreshToken = await hashToken(refreshToken);

  const refreshSession =
    await authRepository.findRefreshToken(hashedRefreshToken);

  if (!refreshSession) {
    await authRepository.revokeUserSessions(decoded.userId);
    throw new AppError(401, "Invalid refresh token");
  }

  await authRepository.revokeRefreshToken(hashedRefreshToken);

  // Generate new tokens
  const tokens = generateTokens(decoded.userId);

  await authRepository.saveRefreshToken(
    decoded.userId,
    refreshSession.device_name,
    refreshSession.ip_address,
    await hashToken(tokens.refreshToken),
    new Date(Date.now() + ms(env.JWT_REFRESH_EXPIRES_IN as ms.StringValue)),
  );

  return tokens;
}

export async function logoutService(
  userId: number,
  accessToken: string,
  refreshToken: string,
) {
  const decodedRefreshToken = verifyToken(refreshToken, "refresh");
  const decodedAccessToken = verifyToken(accessToken, "access");

  if (
    !decodedAccessToken ||
    decodedAccessToken.type !== "access" ||
    decodedAccessToken.userId !== userId
  ) {
    throw new AppError(401, "Invalid access token");
  }
  const hashedRefreshToken = await hashToken(refreshToken);

  const refreshSession =
    await authRepository.findRefreshToken(hashedRefreshToken);

  if (!refreshSession) {
    await authRepository.revokeUserSessions(userId);
    throw new AppError(401, "Invalid refresh token");
  }

  if (
    !decodedRefreshToken ||
    decodedRefreshToken.type !== "refresh" ||
    decodedRefreshToken.userId !== userId
  ) {
    await authRepository.revokeUserSessions(userId);
    throw new AppError(401, "Invalid refresh token");
  }

  await authRepository.revokeRefreshToken(hashedRefreshToken);
  await sharedRepository.revokeAccessToken(accessToken);
}
