/* eslint-disable max-len */
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
  uploadAvatar
} from './user.controller.js'
import { validateBody } from '../../shared/validators/validator.js'
import {
  changePasswordSchema,
  deactivateAccountSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resetPasswordWithTokenSchema,
  updateProfileSchema
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

/**
 * @openapi
 * tags:
 *   - name: Users
 *     description: Current-user profile, public profile, password reset, avatar
 *
 * /users/me:
 *   get:
 *     summary: Get the current user
 *     tags: [Users]
 *     security: [ { cookieAuth: [] } ]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object, properties: { user: { $ref: '#/components/schemas/User' } } }
 *       401: { description: Not authenticated }
 *   patch:
 *     summary: Update the current user's profile
 *     tags: [Users]
 *     security: [ { cookieAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullname: { type: string, minLength: 2, maxLength: 100 }
 *               email: { type: string, format: email }
 *               phone: { type: string, description: 7-15 digits }
 *               description: { type: string, maxLength: 200 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object, properties: { user: { $ref: '#/components/schemas/User' } } }
 *       400: { description: Invalid data, or email/phone already in use }
 *       401: { description: Not authenticated }
 *   delete:
 *     summary: Deactivate (soft delete) the current account
 *     tags: [Users]
 *     security: [ { cookieAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string, format: password, minLength: 8 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object, properties: { message: { type: string } } }
 *       403: { description: Wrong password }
 *
 * /users/{userId}:
 *   get:
 *     summary: Get a user's public profile
 *     tags: [Users]
 *     parameters:
 *       - { in: path, name: userId, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object, properties: { user: { $ref: '#/components/schemas/PublicUser' } } }
 *       400: { description: Invalid user ID }
 *       404: { description: User not found }
 *       410: { description: Account deactivated }
 *
 * /users/me/password:
 *   patch:
 *     summary: Change password
 *     tags: [Users]
 *     security: [ { cookieAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [oldPassword, newPassword]
 *             properties:
 *               oldPassword: { type: string, minLength: 8 }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object, properties: { message: { type: string } } }
 *       403: { description: Old password incorrect }
 *
 * /users/me/avatar:
 *   patch:
 *     summary: Set the avatar from an already-uploaded file URL (JSON, not multipart)
 *     description: Client uploads via /storage/presign (folder=avatars) then sends the resulting publicUrl here as fileUrl.
 *     tags: [Users]
 *     security: [ { cookieAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fileUrl]
 *             properties:
 *               fileUrl: { type: string, format: uri }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object, properties: { avatarUrl: { type: string } } }
 *       400: { description: Missing fileUrl }
 *
 * /users/forgot-password:
 *   post:
 *     summary: Send a password-reset OTP by email
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties: { email: { type: string, format: email } }
 *     responses:
 *       200:
 *         description: OTP sent; data.resetTime indicates when a new request is allowed
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object, properties: { resetTime: { type: string } } }
 *       404: { description: Email not found }
 *       410: { description: Account deactivated }
 *
 * /users/reset-password:
 *   post:
 *     summary: Reset password with email and OTP
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, newPassword]
 *             properties:
 *               email: { type: string, format: email }
 *               otp: { type: string, minLength: 6, maxLength: 6 }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object, properties: { message: { type: string } } }
 *       400: { description: Invalid or expired OTP }
 *
 * /users/reset-password-token:
 *   post:
 *     summary: Reset password with a token from the email link
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object, properties: { message: { type: string } } }
 *       400: { description: Invalid or expired token }
 */
