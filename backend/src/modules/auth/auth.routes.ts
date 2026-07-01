import { Router } from 'express'
import { validateBody } from '../../shared/validators/validator.js'
import {
  loginSchema,
  registerSchema
} from '../../shared/validators/schemas.js'
import { authMiddleware } from './auth.middleware.js'
import { login, register, refreshToken, logout } from './auth.controller.js'

export const authRouter = Router()

authRouter.post('/login', validateBody(loginSchema), login)
authRouter.post('/register', validateBody(registerSchema), register)
authRouter.post('/refresh', refreshToken)
authRouter.post('/logout', authMiddleware, logout)
