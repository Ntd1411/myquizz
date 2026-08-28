import z from 'zod'
import { intQuery } from '../quiz/quiz.schema.js'

/**
 * Which accounts a listing is about.
 *
 * A ban is a soft delete (deleted_at), so "the users" has three possible meanings and
 * the caller has to say which one it wants. The default is 'all' because that is what
 * this endpoint has always returned; an admin screen that wants only live accounts, or
 * only banned ones to review them, asks for it explicitly.
 */
export const USER_STATUS_FILTERS = ['all', 'active', 'banned'] as const

/**
 * Query for GET /admin/users.
 *
 * The defaults live here rather than in the controller, so the values the service
 * applies and the values reported back in meta.pagination are the same object. They
 * used to be re-guessed with `Number(...) || fallback` after validation had already
 * run, which quietly accepted `?limit=abc` as 20 and `?limit=0` as 20 as well.
 */
export const AdminSchema = z.object({
  offset: intQuery(0).default(0),
  limit: intQuery(1, 100).default(20),
  status: z.enum(USER_STATUS_FILTERS).default('all')
})

/**
 * Path parameter for the per-account admin routes.
 *
 * `Number(req.params.id)` turned /admin/users/abc into NaN and handed it to the driver,
 * which fails as a 500 on what is really a bad request. Validated here instead, so the
 * handler only ever sees a positive integer.
 */
export const AdminUserParamsSchema = z.object({
  id: intQuery(1)
})

export type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number]
export type AdminUsersQuery = z.infer<typeof AdminSchema>
export type AdminUserParams = z.infer<typeof AdminUserParamsSchema>
