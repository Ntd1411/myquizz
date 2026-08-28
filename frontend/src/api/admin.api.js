import { http } from './http'
import { unwrap } from './envelope'

/**
 * Admin module, backed by /admin/users. Every endpoint here is refused with a 403 for
 * a non-admin session, and the check is done server side on the role of the row behind
 * the cookie: the `isAdmin` flag in the auth store only decides what is rendered, never
 * what is allowed.
 *
 * This is the one listing in the app that does NOT use cursor pagination. The admin
 * endpoint takes offset/limit and answers with
 * meta.pagination = { offset, limit, total, status }, so `readPagination` from
 * envelope.js (which speaks nextCursor/hasMore) does not apply and the block is read
 * here by hand.
 */

/** Values the `status` filter accepts, mirroring USER_STATUS_FILTERS on the server. */
export const USER_STATUS_FILTERS = ['all', 'active', 'banned']

/**
 * GET /admin/users.
 *
 * `status` picks which accounts are listed - all of them, only live ones, or only
 * banned ones. `total` is counted through the same filter, so it can be trusted to
 * size a pager. Rows carry `deleted_at`: null for a live account, a timestamp for a
 * banned one.
 */
export async function getUsers({ offset = 0, limit = 20, status = 'all' } = {}) {
  const res = await http.get('/admin/users', { params: { offset, limit, status } })
  const { users } = unwrap(res.data)

  const pagination = res.data?.meta?.pagination ?? {}

  return {
    users,
    pagination: {
      offset: pagination.offset ?? offset,
      limit: pagination.limit ?? limit,
      total: pagination.total ?? users.length,
      status: pagination.status ?? status,
    },
  }
}

/**
 * DELETE /admin/users/:id.
 *
 * Despite the verb this is not a hard delete: the backend stamps `deleted_at`, which is
 * exactly what the rest of the app already treats as a deactivated account (every user
 * lookup filters on `deleted_at IS NULL`, so the ban takes the session down with it).
 * That is why the screen calls it "ban" and not "delete", and why it can be lifted
 * again with `unbanUser`.
 *
 * Banning an already banned account succeeds without changing anything, so a retry is
 * harmless. Answers 404 USER_NOT_FOUND for an unknown id, and 400
 * ADMIN_CANNOT_BAN_SELF if an admin aims it at their own account.
 */
export async function banUser(userId) {
  const res = await http.delete(`/admin/users/${userId}`)
  return unwrap(res.data)
}

/**
 * POST /admin/users/:id/restore - clears `deleted_at` and lets the person sign in again.
 * Idempotent in the same way as the ban, and answers 404 USER_NOT_FOUND for an unknown id.
 */
export async function unbanUser(userId) {
  const res = await http.post(`/admin/users/${userId}/restore`)
  return unwrap(res.data)
}
