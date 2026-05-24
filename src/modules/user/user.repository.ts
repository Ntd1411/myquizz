import { pool } from "../../infrastructure/database/connection.js";
import { AppError } from "../../shared/errors/AppError.js";

export class UserRepository {
  // Change user password
  async changePassword(userId: number, newPasswordHash: string): Promise<boolean> {
    const result = await pool.query(
      "UPDATE users SET password = $1 WHERE id = $2",
      [newPasswordHash, userId],
    );

    return result.rowCount !== null && result.rowCount > 0;
  }
}

export const userRepository = new UserRepository();
