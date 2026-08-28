import { pool } from '../../infrastructure/database/connection.js'
import { AppError } from '../../shared/errors/AppError.js'
import type { User } from '../auth/auth.type.js'
import type { UserStatusFilter } from './admin.schema.js'

/**
 * Columns the admin listing is allowed to expose.
 *
 * Never `SELECT *` here: that would put `password` and `google_id` on the wire. The
 * list carries `deleted_at` on purpose - it is the only thing that distinguishes a
 * banned account from a live one, and without it the client cannot render the
 * difference or offer to undo it.
 */
const USER_COLUMNS = 'id, fullname, email, phone, role, avatar, deleted_at, created_at'

/**
 * How each filter narrows the table. Written as full clauses so the listing and the
 * count can share them and cannot drift apart: a total that counts rows the listing
 * filters out makes the last page of the pager unreachable.
 */
const STATUS_WHERE: Record<UserStatusFilter, string> = {
  all: '',
  active: ' WHERE deleted_at IS NULL',
  banned: ' WHERE deleted_at IS NOT NULL'
}

export async function getAllUsers (offset?: number, limit?: number, status: UserStatusFilter = 'all'): Promise<User[]> {
  /*
   * Placeholders are numbered from the array they are pushed onto, never written as
   * literal $1/$2. Hard-coding them meant that a limit without an offset produced
   * `LIMIT $2` against a single-element parameter list, and Postgres refused the whole
   * query. Appending in this order keeps the number and the value in step whichever
   * arguments are present.
   */
  const values: number[] = []

  /*
   * ORDER BY is not decoration: SQL gives no guarantee of row order without it, so
   * OFFSET/LIMIT over an unordered select could show the same account on two pages and
   * never show another. Newest first, with the id as a tiebreaker for accounts created
   * in the same instant, so the sequence is total and stable between requests.
   */
  let query = `SELECT ${USER_COLUMNS} FROM users${STATUS_WHERE[status]} ORDER BY created_at DESC, id DESC`

  if (limit !== undefined) {
    values.push(limit)
    query += ` LIMIT $${values.length}`
  }

  if (offset !== undefined) {
    values.push(offset)
    query += ` OFFSET $${values.length}`
  }

  const result = await pool.query<User>(query, values)
  return result.rows
}

/** Counts the same set the listing pages through, so `total` matches what is listed. */
export async function getUsersCount (status: UserStatusFilter = 'all'): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM users${STATUS_WHERE[status]}`
  )
  const row = result.rows[0]
  if (!row) {
    throw new Error('Failed to retrieve users count')
  }
  return parseInt(row.count, 10)
}

/**
 * Bans an account by stamping `deleted_at`, the same state a self-deactivated account
 * ends in: every user lookup filters on `deleted_at IS NULL`, so the person can no
 * longer sign in while their quizzes and match history stay intact.
 *
 * Deliberately not conditional on `deleted_at IS NULL`. Banning an already banned
 * account is a no-op that succeeds, so a double click or a retried request cannot turn
 * into a 404 that reads as "this account is gone".
 */
export async function deleteUser (id: number): Promise<void> {
  const result = await pool.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [id])
  if (result.rowCount === 0) {
    throw new AppError(404, `User with id ${id} not found`, 'USER_NOT_FOUND')
  }
}

/**
 * Lifts a ban by clearing `deleted_at`. Idempotent for the same reason as the ban: a
 * row count of zero here means no such id, not "was not banned".
 */
export async function restoreUser (id: number): Promise<void> {
  const result = await pool.query('UPDATE users SET deleted_at = NULL WHERE id = $1', [id])
  if (result.rowCount === 0) {
    throw new AppError(404, `User with id ${id} not found`, 'USER_NOT_FOUND')
  }
}
