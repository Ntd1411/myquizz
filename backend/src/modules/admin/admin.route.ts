import { Router } from 'express'
import { authMiddleware } from '../auth/auth.middleware.js'
import * as controller from './admin.controller.js'
import { validateQuery } from '../../shared/validators/validator.js'
import { AdminSchema } from './admin.schema.js'

export const adminRouter: Router = Router()

adminRouter.get('/users', authMiddleware, validateQuery(AdminSchema), controller.getAllUsers)
