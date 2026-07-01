import { pool } from '../../infrastructure/database/connection.js'
import type { User } from '../types/shared.types.js'
import { hashToken } from '../utils/auth.utils.js'

export class SharedRepository {
  // Kiểm tra nếu token đã bị blacklist
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const hashedToken = hashToken(token)
    const result = await pool.query(
      'SELECT 1 FROM blacklist_token WHERE token = $1',
      [hashedToken]
    )
    return result.rows.length > 0
  }

  // Revoke access token
  async revokeAccessToken(token: string): Promise<void> {
    const hashedToken = hashToken(token)
    await pool.query(
      'INSERT INTO blacklist_token (token) VALUES ($1) ON CONFLICT DO NOTHING',
      [hashedToken]
    )
  }

  // Find user by id
  async findById(id: number): Promise<User | null> {
    const result = await pool.query<User>('SELECT * FROM users WHERE id = $1 and deleted_at IS NULL', [id])
    return result.rows[0] || null
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

export const sharedRepository = new SharedRepository()
