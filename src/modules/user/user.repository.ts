import { pool } from "../../infrastructure/database/connection.js";
import { AppError } from "../../shared/errors/AppError.js";

export class UserRepository {
  // Change user password
  async changePassword(
    userId: number,
    newPasswordHash: string,
  ): Promise<boolean> {
    const result = await pool.query(
      "UPDATE users SET password = $1 WHERE id = $2",
      [newPasswordHash, userId],
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  // Update profile user
  async updateProfile(
    userId: number,
    updates: Record<string, string>,
  ): Promise<boolean> {
    const fieldsToUpdate: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      fieldsToUpdate.push(`${key} = $${paramIndex++}`);
      values.push(value);
    }

    if (fieldsToUpdate.length === 0) {
      return false;
    }

    const query = `UPDATE users SET ${fieldsToUpdate.join(", ")} WHERE id = $${paramIndex}`;
    values.push(userId);

    const result = await pool.query(query, values);

    return result.rowCount !== null && result.rowCount === 1;
  }

  // Upload avatar user
  async uploadAvatar(userId: number, avatarUrl: string): Promise<boolean> {
    const result = await pool.query(
      "UPDATE users SET avatar = $1 WHERE id = $2",
      [avatarUrl, userId],
    );

    return result.rowCount !== null && result.rowCount === 1;
  }

  // Deactivate user account
  async deactivate(userId: number): Promise<boolean> {
    const result = await pool.query(
      "UPDATE users SET deleted_at = NOW() WHERE id = $1",
      [userId],
    );
    return result.rowCount !== null && result.rowCount === 1;
  }
}

export const userRepository = new UserRepository();
