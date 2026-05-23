import { Router } from 'express'
import { authMiddleware } from '../../shared/middlewares/auth.middleware.js'
import { changePassword, deleteAccount, getMe, getUserById, updateProfile, uploadAvatar } from './user.controller.js'

export const userRouter = Router()

userRouter.get('/me', authMiddleware, getMe)
userRouter.get('/:userId', getUserById)
userRouter.patch('/password', authMiddleware, changePassword)
userRouter.patch('/avatar', authMiddleware, uploadAvatar)
userRouter.patch('/profile', authMiddleware, updateProfile)
userRouter.delete('/account', authMiddleware, deleteAccount)