import { pool } from '../../infrastructure/database/connection.js'
import type { User } from '../auth/auth.type.js'

export class UserRepository {
  // Change user password
  async changePassword(
    userId: number,
    newPasswordHash: string
  ): Promise<boolean> {
    const result = await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [newPasswordHash, userId]
    )

    return result.rowCount !== null && result.rowCount > 0
  }

  // Update profile user
  async updateProfile(
    userId: number,
    updates: Record<string, string>
  ): Promise<boolean> {
    const fieldsToUpdate: string[] = []
    const values: (string | number)[] = []
    let paramIndex = 1

    for (const [key, value] of Object.entries(updates)) {
      fieldsToUpdate.push(`${key} = $${paramIndex++}`)
      values.push(value)
    }

    if (fieldsToUpdate.length === 0) {
      return false
    }

    const query = `UPDATE users SET ${fieldsToUpdate.join(', ')} WHERE id = $${paramIndex}`
    values.push(userId)

    const result = await pool.query(query, values)

    return result.rowCount !== null && result.rowCount === 1
  }

  // Upload avatar user
  async uploadAvatar(userId: number, avatarUrl: string): Promise<boolean> {
    const result = await pool.query(
      'UPDATE users SET avatar = $1 WHERE id = $2',
      [avatarUrl, userId]
    )

    return result.rowCount !== null && result.rowCount === 1
  }

  // Deactivate user account
  async deactivate(userId: number): Promise<boolean> {
    const result = await pool.query(
      'UPDATE users SET deleted_at = NOW() WHERE id = $1',
      [userId]
    )
    return result.rowCount !== null && result.rowCount === 1
  }

  // Find user by id
  async findById(id: number): Promise<User | null> {
    const result = await pool.query<User>('SELECT * FROM users WHERE id = $1 and deleted_at IS NULL', [id])
    return result.rows[0] || null
  }

  // Check a user exists and has not been soft-deleted. Cheaper than findById
  // when only existence matters, e.g. before listing a public profile.
  async existsById(id: number): Promise<boolean> {
    const result = await pool.query(
      'SELECT 1 FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    )
    return result.rowCount !== null && result.rowCount > 0
  }

  // Find user by email
  async findByEmail(email: string): Promise<User | null> {
    const result = await pool.query<User>('SELECT * FROM users WHERE email = $1', [
      email
    ])
    return result.rows[0] || null
  }

  // Find user by phone
  async findByPhone(phone: string): Promise<User | null> {
    const result = await pool.query<User>('SELECT * FROM users WHERE phone = $1', [
      phone
    ])
    return result.rows[0] || null
  }
}

export const userRepository = new UserRepository()
