import { Router } from 'express'
import { authMiddleware } from '../auth/auth.middleware.js'
import * as controller from './admin.controller.js'
import { validateParams, validateQuery } from '../../shared/validators/validator.js'
import { AdminSchema, AdminUserParamsSchema } from './admin.schema.js'

export const adminRouter: Router = Router()

/*
 * Admin routes. authMiddleware only establishes who is calling; the admin check itself
 * is in the controller, so a new route here cannot be reachable by a normal account by
 * accident.
 *
 * The ban is a DELETE because it soft deletes the account, and its undo is a POST to a
 * sub-resource rather than a second DELETE with a flag.
 */
adminRouter.get('/users', authMiddleware, validateQuery(AdminSchema), controller.getAllUsers)
adminRouter.delete('/users/:id', authMiddleware, validateParams(AdminUserParamsSchema), controller.deleteUser)
adminRouter.post('/users/:id/restore', authMiddleware, validateParams(AdminUserParamsSchema), controller.restoreUser)
