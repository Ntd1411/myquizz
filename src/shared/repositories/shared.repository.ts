import { pool } from "../../infrastructure/database/connection.js";
import type { User } from "../types/shared.types.js";
import { hashToken } from "../utils/auth.utils.js";

export class SharedRepository {
  // Kiểm tra nếu token đã bị blacklist
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const hashedToken = await hashToken(token);
    const result = await pool.query(
      "SELECT 1 FROM blacklist_token WHERE token = $1",
      [hashedToken],
    );
    return result.rows.length > 0;
  }

  // Revoke access token
  async revokeAccessToken(token: string): Promise<void> {
    const hashedToken = await hashToken(token);
    await pool.query(
      "INSERT INTO blacklist_token (token) VALUES ($1) ON CONFLICT DO NOTHING",
      [hashedToken],
    );
  }

  // Find user by id
  async findById(id: number): Promise<User | null> {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return result.rows[0] || null;
  }
}

export const sharedRepository = new SharedRepository();
