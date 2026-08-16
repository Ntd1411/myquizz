import { Router } from 'express'
import { validateBody } from '../../shared/validators/validator.js'
import {
  loginSchema,
  registerSchema
} from './auth.schema.js'
import { login, register, refreshToken, logout, googleCallback, googleRedirect, googleOneTap } from './auth.controller.js'
import { authRateLimiter } from '../../shared/middlewares/rate.limit.middleware.js'
import { authMiddleware } from './auth.middleware.js'

export const authRouter: Router = Router()

authRouter.post('/login', validateBody(loginSchema), authRateLimiter, login)

authRouter.post('/register', validateBody(registerSchema), authRateLimiter, register)

authRouter.post('/refresh', refreshToken)

authRouter.post('/logout', authMiddleware, logout)

authRouter.get('/google', googleRedirect)

authRouter.get('/google/callback', googleCallback)

authRouter.post('/google/one-tap', googleOneTap)
