import { Router } from 'express'
import { authMiddleware } from '../auth/auth.middleware.js'
import {
  changePassword,
  completeReset,
  deactivateAccount,
  forgotPassword,
  getMe,
  getResetTicket,
  getUser,
  updateProfile,
  uploadAvatar,
  verifyReset
} from './user.controller.js'
import { validateBody } from '../../shared/validators/validator.js'
import {
  changePasswordSchema,
  completeResetSchema,
  deactivateAccountSchema,
  forgotPasswordSchema,
  updateProfileSchema,
  verifyResetSchema
} from './user.schema.js'
import {
  authRateLimiter,
  resetPasswordRateLimiter,
  resetVerifyRateLimiter
} from '../../shared/middlewares/rate.limit.middleware.js'

export const userRouter: Router = Router()

userRouter.get('/me', authMiddleware, getMe)

userRouter.patch('/me', authMiddleware, validateBody(updateProfileSchema), updateProfile)

userRouter.delete( '/me', authMiddleware, validateBody(deactivateAccountSchema), deactivateAccount)

userRouter.get('/:userId', getUser)

userRouter.patch( '/me/password', authMiddleware, authRateLimiter, validateBody(changePasswordSchema), changePassword)

userRouter.patch('/me/avatar', authMiddleware, uploadAvatar)

userRouter.post( '/forgot-password', authRateLimiter, validateBody(forgotPasswordSchema), forgotPassword)

// The reset runs in three steps: ask for a code, prove the email arrived, then
// write the password with the ticket that proof handed out. Nothing but the last
// step touches the password, and it never sees the code or the emailed token.
userRouter.post( '/password-reset/verify', resetVerifyRateLimiter, validateBody(verifyResetSchema), verifyReset)

userRouter.get('/password-reset/ticket', resetVerifyRateLimiter, getResetTicket)

userRouter.post( '/password-reset/complete', resetPasswordRateLimiter, validateBody(completeResetSchema), completeReset)
