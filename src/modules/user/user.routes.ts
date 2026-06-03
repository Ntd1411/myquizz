import { Router } from 'express'
import { authMiddleware } from '../auth/auth.middleware.js'
import {
  changePassword,
  deactivateAccount,
  getMe,
  getUser,
  updateProfile,
  uploadAvatar
} from './user.controller.js'
import { validateBody } from '../../shared/validators/validator.js'
import {
  changePasswordSchema,
  deactivateAccountSchema,
  updateProfileSchema
} from '../../shared/validators/schemas.js'
import { uploadMiddleware } from '../../infrastructure/config/multer.config.js'

export const userRouter = Router()

userRouter.get('/me', authMiddleware, getMe)
userRouter.patch(
  '/me',
  authMiddleware,
  validateBody(updateProfileSchema),
  updateProfile
)
userRouter.delete(
  '/me',
  authMiddleware,
  validateBody(deactivateAccountSchema),
  deactivateAccount
)
userRouter.get('/:userId', getUser)
userRouter.patch(
  '/me/password',
  authMiddleware,
  validateBody(changePasswordSchema),
  changePassword
)
userRouter.patch(
  '/me/avatar',
  authMiddleware,
  uploadMiddleware.single('avatar'),
  uploadAvatar
)
