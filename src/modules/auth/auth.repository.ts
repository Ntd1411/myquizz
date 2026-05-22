import { pool } from "../../infrastructure/database/connection.js";
import { type User } from "./auth.type.js";

export class AuthRepository {
  // Tìm user theo email
  async findByEmail(email: string): Promise<User | null> {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    return result.rows[0] || null;
  }

  // Tìm user theo ID
  async findById(id: number): Promise<User | null> {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return result.rows[0] || null;
  }

  // Kiểm tra user có role admin không
  async isAdmin(userId: number): Promise<boolean> {
    const result = await pool.query("SELECT role FROM users WHERE id = $1", [
      userId,
    ]);
    return result.rows[0]?.role === "admin";
  }

  // Tạo user mới
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

  // Cập nhật last login
  async updateLastLogin(userId: number): Promise<void> {
    await pool.query("UPDATE users SET updated_at = NOW() WHERE id = $1", [
      userId,
    ]);
  }

  // Kiểm tra email tồn tại
  async emailExists(email: string): Promise<boolean> {
    const result = await pool.query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);
    return result.rows.length > 0;
  }

  // Kiểm tra số điệnt thoại tồn tại
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

  // Lưu refresh token
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

  // Kiểm tra refresh token hợp lệ
  async findRefreshToken(refreshToken: string): Promise<any> {
    const result = await pool.query(
      "SELECT * FROM refresh_sessions WHERE refresh_token = $1",
      [refreshToken],
    );
    return result.rows[0] || null;
  }

  // Revoke refresh token
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    await pool.query(
      "DELETE FROM refresh_sessions WHERE refresh_token = $1",
      [refreshToken],
    );
  }

  async revokeUserSessions(userId: number): Promise<void> {
    await pool.query(
      "DELETE FROM refresh_sessions WHERE user_id = $1",
      [userId],
    );
  }
}

export const authRepository = new AuthRepository();
