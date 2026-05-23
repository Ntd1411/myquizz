import { pool } from "../../infrastructure/database/connection.js";
import type { User } from "../../shared/types/shared.types.js";

export class UserRepository {
  // Get user by ID
  async getUserById(userId: string): Promise<User | null> {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);
    return result.rows[0] || null;
  }
}

export const userRepository = new UserRepository();
