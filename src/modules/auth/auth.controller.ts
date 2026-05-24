import type { Request, Response, NextFunction } from "express";
import { config } from "../../infrastructure/config/config.js";
import ms from "ms";
import { type AuthRequest } from "../../shared/types/shared.types.js";
import {
  loginService,
  logoutService,
  refreshTokenService,
  registerService,
} from "./auth.services.js";

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    const deviceName = req.headers["user-agent"] || "Unknown Device";
    const ipAddress = req.ip || req.socket.remoteAddress || "unknown";

    const result = await loginService(email, password, deviceName, ipAddress);

    // Set HttpOnly cookie
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: ms(config.jwt.jwtRefreshExpiresIn as ms.StringValue),
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    res.json({
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (error) {
    next(error);
  }
}

export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { email, phone, password, fullname } = req.body;

    const result = await registerService(
      email,
      password,
      fullname,
      phone || null,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function refreshToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token missing" });
    }

    const tokens = await refreshTokenService(refreshToken);

    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: ms(config.jwt.jwtRefreshExpiresIn as ms.StringValue),
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    res.json({ accessToken: tokens.accessToken });
  } catch (error) {
    next(error);
  }
}

export async function logout(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const accessToken = req.token || "";
    const userId = req.user?.id || 0;
    const refreshToken = req.cookies.refreshToken || "";

    if (!accessToken || !refreshToken) {
      return res
        .status(400)
        .json({ message: "Access token and refresh token are required" });
    }

    await logoutService(userId, accessToken, refreshToken);

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
}
