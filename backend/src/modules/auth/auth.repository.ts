import { pool, withTransaction } from '../../infrastructure/database/connection.js'
import type { User, RefreshSession } from './auth.type.js'
import { hashToken } from './auth.util.js'
import jwt from 'jsonwebtoken'

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

  async rotateRefreshToken(oldHash: string, userId: number, newHash: string, expiresAt: Date): Promise<boolean> {
    return withTransaction(async (client) => {
      const consumed = await client.query<RefreshSession>(
        `DELETE FROM refresh_sessions
         WHERE refresh_token = $1 AND user_id = $2 AND expires_at > now()
         RETURNING *`,
        [oldHash, userId]
      )
      const session = consumed.rows[0]
      if (!session) {
        const replay = await client.query<{ family_id: string; old_enough: boolean }>(
          `SELECT family_id, consumed_at < now() - interval '10 seconds' AS old_enough
           FROM consumed_refresh_tokens WHERE token_hash = $1 AND user_id = $2 AND expires_at > now()`,
          [oldHash, userId]
        )
        if (replay.rows[0]?.old_enough)
          await client.query('DELETE FROM refresh_sessions WHERE family_id = $1 AND user_id = $2',
            [replay.rows[0].family_id, userId])
        return false
      }
      await client.query(
        `INSERT INTO consumed_refresh_tokens (token_hash, user_id, family_id, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [oldHash, userId, session.family_id, session.expires_at]
      )
      await client.query(
        `INSERT INTO refresh_sessions (user_id, device_name, ip_address, refresh_token, expires_at, family_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, session.device_name, session.ip_address, newHash, expiresAt, session.family_id]
      )
      return true
    })
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

  // Check if access token is blacklisted
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const hashedToken = hashToken(token)
    const result = await pool.query(
      'SELECT 1 FROM blacklist_token WHERE token = $1 AND expires_at > now()',
      [hashedToken]
    )
    return result.rows.length > 0
  }

  // Revoke access token
  async revokeAccessToken(token: string): Promise<void> {
    const hashedToken = hashToken(token)
    const decoded = jwt.decode(token)
    if (!decoded || typeof decoded === 'string' || !decoded.exp) return
    await pool.query(
      `INSERT INTO blacklist_token (token, expires_at) VALUES ($1, to_timestamp($2))
       ON CONFLICT DO NOTHING`,
      [hashedToken, decoded.exp]
    )
  }

  async cleanupExpiredTokens(): Promise<void> {
    await pool.query('DELETE FROM blacklist_token WHERE expires_at <= now()')
    await pool.query('DELETE FROM refresh_sessions WHERE expires_at <= now()')
    await pool.query('DELETE FROM consumed_refresh_tokens WHERE expires_at <= now()')
  }
}

export const authRepository = new AuthRepository()
