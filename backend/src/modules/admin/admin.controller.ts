import type { Response, NextFunction } from 'express'
import { AppError } from '../../shared/errors/AppError.js'
import { success } from '../../shared/utils/response.js'
import type { AuthRequest, User } from '../auth/auth.type.js'
import * as adminService from './admin.service.js'
import type { AdminUserParams, AdminUsersQuery } from './admin.schema.js'

/**
 * The one gate on this module, called first by every handler.
 *
 * Kept here rather than as route middleware so that adding a handler cannot ship an
 * unguarded endpoint by forgetting a line in the router, and so the caller gets the
 * admin's own row back for rules that involve who is acting.
 */
function assertAdmin(req: AuthRequest): User {
  if (!req.user || req.user.role !== 'admin') {
    throw new AppError(403, 'Access denied', 'FORBIDDEN')
  }
  return req.user
}

export async function getAllUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertAdmin(req)

    // The validated query, not req.query: the schema has already rejected a bad offset
    // or limit and filled in the defaults, so nothing is re-guessed here.
    const { offset, limit, status } = req.validatedQuery as AdminUsersQuery

    const { users, pagination } = await adminService.getAllUsers(offset, limit, status)

    success(res, { users }, 200, { pagination })
  } catch (error) {
    next(error)
  }
}

export async function deleteUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const admin = assertAdmin(req)
    const { id } = req.validatedParams as AdminUserParams

    /*
     * An admin banning themselves would take away the session and the role needed to
     * undo it, which on a workspace with a single admin locks the module for good. The
     * screen already omits the control; this is the rule that actually holds, since a
     * request can be made without the screen.
     */
    if (id === admin.id) {
      throw new AppError(400, `Admin ${admin.id} attempted to ban their own account`, 'ADMIN_CANNOT_BAN_SELF')
    }

    await adminService.deleteUser(id)

    success(res, { message: 'User banned successfully' })
  } catch (error) {
    next(error)
  }
}

export async function restoreUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    assertAdmin(req)
    const { id } = req.validatedParams as AdminUserParams

    await adminService.restoreUser(id)

    success(res, { message: 'User restored successfully' })
  } catch (error) {
    next(error)
  }
}
