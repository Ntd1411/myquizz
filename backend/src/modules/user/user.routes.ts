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
} from './user.schemas.js'
import { authRateLimiter } from '../../shared/middlewares/rate.limit.middleware.js'

export const userRouter: Router = Router()

/**
 * @swagger
 * /api/v1/users/me:
 *   get:
 *     summary: Lấy thông tin user hiện tại
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Thông tin user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: number
 *                   example: 3
 *                 fullname:
 *                   type: string
 *                   example: Nguyen Van A
 *                 email:
 *                   type: string
 *                   example: user@example.com
 *                 phone:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *                 role:
 *                   type: string
 *                   example: user
 *                 avatar:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *                 description:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                   example: 2026-07-17T09:32:35.931Z
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *                   example: 2026-07-17T09:32:35.931Z
 *       401:
 *         description: Chưa đăng nhập
 */
userRouter.get('/me', authMiddleware, getMe)

/**
 * @swagger
 * /api/v1/users/me:
 *   patch:
 *     summary: Cập nhật thông tin profile
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullname:
 *                 type: string
 *                 example: Nguyen Van B
 *               email:
 *                 type: string
 *                 format: email
 *                 example: newmail@example.com
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc email/phone đã được sử dụng
 *       401:
 *         description: Chưa đăng nhập
 */
userRouter.patch(
  '/me',
  authMiddleware,
  validateBody(updateProfileSchema),
  updateProfile
)

/**
 * @swagger
 * /api/v1/users/me:
 *   delete:
 *     summary: Vô hiệu hóa tài khoản
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Mật khẩu hiện tại để xác nhận
 *                 example: password123
 *     responses:
 *       200:
 *         description: Vô hiệu hóa tài khoản thành công
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Mật khẩu không đúng
 */
userRouter.delete(
  '/me',
  authMiddleware,
  validateBody(deactivateAccountSchema),
  deactivateAccount
)

/**
 * @swagger
 * /api/v1/users/{userId}:
 *   get:
 *     summary: Lấy thông tin user theo ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của user
 *         example: 1
 *     responses:
 *       200:
 *         description: Thông tin user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: number
 *                   example: 1
 *                 fullname:
 *                   type: string
 *                   example: Nguyen Van A
 *                 email:
 *                   type: string
 *                   example: newuser@example.com
 *                 avatar:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *                 description:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *       404:
 *         description: Không tìm thấy user
 *       410:
 *         description: Tài khoản đã bị vô hiệu hóa
 */
userRouter.get('/:userId', getUser)

/**
 * @swagger
 * /api/v1/users/me/password:
 *   patch:
 *     summary: Đổi mật khẩu
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: oldpassword123
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: newpassword123
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc mật khẩu mới trùng với mật khẩu cũ
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Mật khẩu cũ không đúng
 */
userRouter.patch(
  '/me/password',
  authMiddleware,
  authRateLimiter,
  validateBody(changePasswordSchema),
  changePassword
)

/**
 * @swagger
 * /api/v1/users/me/avatar:
 *   patch:
 *     summary: Upload avatar
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: File ảnh avatar (jpg, png, gif)
 *     responses:
 *       200:
 *         description: Upload thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Avatar uploaded successfully
 *                 fileUrl:
 *                   type: string
 *                   example: https://sgp1.digitaloceanspaces.com/myquizz/avatars/3/avatar.jpg
 *       400:
 *         description: File không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi khi upload file
 */
userRouter.patch(
  '/me/avatar',
  authMiddleware,
  uploadAvatar
)

/**
 * @swagger
 * /api/v1/users/forgot-password:
 *   post:
 *     summary: Quên mật khẩu - Gửi OTP qua email
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: OTP đã được gửi qua email
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: OTP sent to your email
 *       404:
 *         description: Email không tồn tại
 *       410:
 *         description: Tài khoản đã bị vô hiệu hóa
 */
userRouter.post(
  '/forgot-password',
  authRateLimiter,
  validateBody(forgotPasswordSchema),
  forgotPassword
)

/**
 * @swagger
 * /api/v1/users/reset-password:
 *   post:
 *     summary: Reset mật khẩu với OTP
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               otp:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 example: "123456"
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: newpassword123
 *     responses:
 *       200:
 *         description: Mật khẩu đã được reset thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password reset successfully
 *       400:
 *         description: OTP không hợp lệ hoặc đã hết hạn
 *       404:
 *         description: Người dùng không tồn tại
 */
userRouter.post(
  '/reset-password',
  authRateLimiter,
  validateBody(resetPasswordSchema),
  resetPassword
)

/**
 * @swagger
 * /api/v1/users/reset-password-token:
 *   post:
 *     summary: Reset mật khẩu với token từ link email
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *                 example: "a1b2c3d4e5f6..."
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: newpassword123
 *     responses:
 *       200:
 *         description: Mật khẩu đã được reset thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password reset successfully
 *       400:
 *         description: Token không hợp lệ hoặc đã hết hạn
 *       404:
 *         description: Người dùng không tồn tại
 */
userRouter.post(
  '/reset-password-token',
  authRateLimiter,
  validateBody(resetPasswordWithTokenSchema),
  resetPasswordWithToken
)
