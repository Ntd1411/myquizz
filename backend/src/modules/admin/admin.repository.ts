import { pool } from '../../infrastructure/database/connection.js'
import type { User } from '../auth/auth.type.js'

export async function getAllUsers (offset?: number, limit?: number): Promise<User[]> {
  let query = 'SELECT id, fullname, email, phone, role, created_at FROM users'
  const values: (number | undefined)[] = []

  if (offset !== undefined) {
    query += ' OFFSET $1'
    values.push(offset)
  }

  if (limit !== undefined) {
    query += ' LIMIT $2'
    values.push(limit)
  }

  const result = await pool.query<User>(query, values)
  return result.rows
}

export async function getUsersCount (): Promise<number> {
  const result = await pool.query<{ count: string }>('SELECT COUNT(*) FROM users')
  if (!result.rows[0] || result.rows.length === 0) {
    throw new Error('Failed to retrieve users count')
  }
  return parseInt(result.rows[0].count, 10)
}
