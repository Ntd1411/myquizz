import { Router } from 'express'
import { authMiddleware } from '../auth/auth.middleware.js'
import {
  changePassword,
  deactivateAccount,
  forgotPassword,
  getMe,
  getUser,
  resetPassword,
  resetPasswordWithToken,
  updateProfile,
  verifyResetToken,
  uploadAvatar
} from './user.controller.js'
import { validateBody } from '../../shared/validators/validator.js'
import {
  changePasswordSchema,
  deactivateAccountSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resetPasswordWithTokenSchema,
  updateProfileSchema,
  verifyResetTokenSchema
} from './user.schema.js'
import {
  authRateLimiter,
  resetPasswordRateLimiter
} from '../../shared/middlewares/rate.limit.middleware.js'

export const userRouter: Router = Router()

userRouter.get('/me', authMiddleware, getMe)

userRouter.patch('/me', authMiddleware, validateBody(updateProfileSchema), updateProfile)

userRouter.delete( '/me', authMiddleware, validateBody(deactivateAccountSchema), deactivateAccount)

userRouter.get('/:userId', getUser)

userRouter.patch( '/me/password', authMiddleware, authRateLimiter, validateBody(changePasswordSchema), changePassword)

userRouter.patch('/me/avatar', authMiddleware, uploadAvatar)

userRouter.post( '/forgot-password', authRateLimiter, validateBody(forgotPasswordSchema), forgotPassword)

userRouter.post( '/reset-password', resetPasswordRateLimiter, validateBody(resetPasswordSchema), resetPassword)

userRouter.post( '/reset-password-token', resetPasswordRateLimiter, validateBody(resetPasswordWithTokenSchema), resetPasswordWithToken)

userRouter.post( '/reset-password-token/verify', resetPasswordRateLimiter, validateBody(verifyResetTokenSchema), verifyResetToken)
