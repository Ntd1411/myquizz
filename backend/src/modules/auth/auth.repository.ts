import { pool } from '../../infrastructure/database/connection.js'
import type { User, RefreshSession } from './auth.type.js'
import { hashToken } from './auth.util.js'

export class AuthRepository {
  // Create new user
  async addUser(data: {
    fullname: string;
    email: string;
    phone?: string | null;
    password: string;
    role?: 'admin' | 'moderator' | 'user';
  }): Promise<User | undefined> {
    const result = await pool.query<User>(
      `INSERT INTO users (fullname, email, phone, password, role) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [
        data.fullname,
        data.email,
        data.phone,
        data.password,
        data.role || 'user'
      ]
    )
    return result.rows[0]
  }

  // Update last login
  async updateLastLogin(userId: number): Promise<void> {
    await pool.query('UPDATE users SET updated_at = NOW() WHERE id = $1', [
      userId
    ])
  }

  // Check if email exists
  async emailExists(email: string): Promise<boolean> {
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [
      email
    ])
    return result.rows.length > 0
  }

  // Check if phone number exists
  async phoneExists(phone: string): Promise<boolean> {
    const result = await pool.query('SELECT id FROM users WHERE phone = $1', [
      phone
    ])
    return result.rows.length > 0
  }

  // Save refresh token
  async saveRefreshToken(
    userId: number,
    deviceName: string,
    ipAddress: string,
    refreshToken: string,
    expiresAt: Date
  ): Promise<void> {
    await pool.query(
      'INSERT INTO refresh_sessions (user_id, device_name, ip_address, refresh_token, expires_at) VALUES ($1, $2, $3, $4, $5)',
      [userId, deviceName, ipAddress, refreshToken, expiresAt]
    )
  }

  // Find refresh token
  async findRefreshToken(refreshToken: string): Promise<RefreshSession | null> {
    const result = await pool.query<RefreshSession>(
      'SELECT * FROM refresh_sessions WHERE refresh_token = $1',
      [refreshToken]
    )
    return result.rows[0] || null
  }

  // Find user by Google account id
  async findByGoogleId(googleId: string): Promise<User | null> {
    const result = await pool.query<User>(
      'SELECT * FROM users WHERE google_id = $1 AND deleted_at IS NULL',
      [googleId]
    )
    return result.rows[0] || null
  }

  // Link a Google account to an existing user (keep existing avatar if any)
  async linkGoogleId(
    userId: number,
    googleId: string,
    avatar?: string | null
  ): Promise<User> {
    const result = await pool.query<User>(
      `UPDATE users
        SET google_id = $2,
            avatar = COALESCE(avatar, $3),
            updated_at = NOW()
      WHERE id = $1
  RETURNING *`,
      [userId, googleId, avatar ?? null]
    )
    return result.rows[0] as User
  }

  // Create a user coming from Google (no local password)
  async addGoogleUser(data: {
    fullname: string
    email: string
    googleId: string
    avatar?: string | null
  }): Promise<User> {
    const result = await pool.query<User>(
      `INSERT INTO users (fullname, email, google_id, avatar, auth_provider, password)
      VALUES ($1, $2, $3, $4, 'google', NULL)
    RETURNING *`,
      [data.fullname, data.email, data.googleId, data.avatar ?? null]
    )
    return result.rows[0] as User
  }

  // Revoke refresh token
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    await pool.query('DELETE FROM refresh_sessions WHERE refresh_token = $1', [
      refreshToken
    ])
  }

  async revokeUserSessions(userId: number): Promise<void> {
    await pool.query('DELETE FROM refresh_sessions WHERE user_id = $1', [
      userId
    ])
  }

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
}

export const authRepository = new AuthRepository()
