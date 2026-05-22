import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../../infrastructure/config/config.js";
import ms from "ms";
import { AppError } from "../errors/AppError.js";

// Token hashing
export async function hashToken(token: string): Promise<string> {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// Token generation
export function generateTokens(userId: number) {
  const accessToken = jwt.sign(
    { userId, type: "access" },
    config.jwt.jwtSecret,
    { expiresIn: config.jwt.jwtExpiresIn as ms.StringValue },
  );

  const refreshToken = jwt.sign(
    { userId, type: "refresh" },
    config.jwt.jwtRefreshSecret,
    {
      expiresIn: config.jwt.jwtRefreshExpiresIn as ms.StringValue,
    },
  );

  return { accessToken, refreshToken };
}

export function verifyToken(token: string, type: "access" | "refresh"): any {
  try {
    const secret =
      type === "access" ? config.jwt.jwtSecret : config.jwt.jwtRefreshSecret;
    return jwt.verify(token, secret);
  } catch (error) {
    throw new AppError(401, `Invalid ${type} token`);
  }
}
