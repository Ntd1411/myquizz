import { pool } from "../../infrastructure/database/connection.js";
import {
  type RefreshSession,
  type User,
} from "../../shared/types/shared.types.js";

export class AuthRepository {
  // Create new user
  async addUser(data: {
    fullname: string;
    email: string;
    phone?: string | null;
    password: string;
    role?: "admin" | "moderator" | "user";
  }): Promise<User> {
    const result = await pool.query(
      `INSERT INTO users (fullname, email, phone, password, role) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [
        data.fullname,
        data.email,
        data.phone,
        data.password,
        data.role || "user",
      ],
    );
    return result.rows[0];
  }

  // Update last login
  async updateLastLogin(userId: number): Promise<void> {
    await pool.query("UPDATE users SET updated_at = NOW() WHERE id = $1", [
      userId,
    ]);
  }

  // Check if email exists
  async emailExists(email: string): Promise<boolean> {
    const result = await pool.query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);
    return result.rows.length > 0;
  }

  // Check if phone number exists
  async phoneExists(phone: string): Promise<boolean> {
    const result = await pool.query("SELECT id FROM users WHERE phone = $1", [
      phone,
    ]);
    return result.rows.length > 0;
  }

  // Deactivate user
  async deactivate(userId: number): Promise<void> {
    await pool.query("UPDATE users SET is_active = false WHERE id = $1", [
      userId,
    ]);
  }

  // Save refresh token
  async saveRefreshToken(
    userId: number,
    deviceName: string,
    ipAddress: string,
    refreshToken: string,
    expiresAt: Date,
  ): Promise<void> {
    await pool.query(
      "INSERT INTO refresh_sessions (user_id, device_name, ip_address, refresh_token, expires_at) VALUES ($1, $2, $3, $4, $5)",
      [userId, deviceName, ipAddress, refreshToken, expiresAt],
    );
  }

  // Find refresh token
  async findRefreshToken(refreshToken: string): Promise<RefreshSession | null> {
    const result = await pool.query(
      "SELECT * FROM refresh_sessions WHERE refresh_token = $1",
      [refreshToken],
    );
    return result.rows[0] || null;
  }

  // Revoke refresh token
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    await pool.query("DELETE FROM refresh_sessions WHERE refresh_token = $1", [
      refreshToken,
    ]);
  }

  async revokeUserSessions(userId: number): Promise<void> {
    await pool.query("DELETE FROM refresh_sessions WHERE user_id = $1", [
      userId,
    ]);
  }
}

export const authRepository = new AuthRepository();
