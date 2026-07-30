import { Router } from 'express'
import { validateBody } from '../../shared/validators/validator.js'
import {
  loginSchema,
  registerSchema
} from './auth.schemas.js'
import { authMiddleware } from './auth.middleware.js'
import { login, register, refreshToken, logout, googleCallback, googleRedirect, googleOneTap } from './auth.controller.js'
import { authRateLimiter } from '../../shared/middlewares/rate.limit.middleware.js'

export const authRouter: Router = Router()

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Đăng nhập
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: password123
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: number
 *                       example: 3
 *                     fullname:
 *                       type: string
 *                       example: Nguyen Van A
 *                     email:
 *                       type: string
 *                       example: user@example.com
 *                     phone:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                     role:
 *                       type: string
 *                       example: user
 *                     avatar:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                     description:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: 2026-07-17T09:32:35.931Z
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       example: 2026-07-17T09:32:35.931Z
 *       401:
 *         description: Thông tin đăng nhập không đúng
 *       403:
 *         description: Tài khoản bị vô hiệu hóa
 */
authRouter.post('/login', validateBody(loginSchema), authRateLimiter, login)

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Đăng ký tài khoản mới
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullname
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: password123
 *               fullname:
 *                 type: string
 *                 example: Nguyen Van A
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: number
 *                   example: 6
 *                 fullname:
 *                   type: string
 *                   example: Nguyen Van A
 *                 email:
 *                   type: string
 *                   example: userd2@example.com
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
 *                   example: 2026-07-17T09:36:05.913Z
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *                   example: 2026-07-17T09:36:05.913Z
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       409:
 *         description: Số điện thoại hoặc email đã được đăng ký
 *       500:
 *         description: Lỗi máy chủ
 */
authRouter.post('/register', validateBody(registerSchema), authRateLimiter, register)

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Làm mới access token
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Refresh token thành công
 *       401:
 *         description: Refresh token không hợp lệ
 */
authRouter.post('/refresh', refreshToken)

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Đăng xuất
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 *       401:
 *         description: Chưa đăng nhập
 */
authRouter.post('/logout', authMiddleware, logout)

/**
 * @swagger
 * /api/v1/auth/google:
 *   get:
 *     summary: Bắt đầu đăng nhập Google (redirect sang trang consent của Google)
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirect sang Google
 */
authRouter.get('/google', authRateLimiter, googleRedirect)

/**
 * @swagger
 * /api/v1/auth/google/callback:
 *   get:
 *     summary: Google callback; phát cookie access + refresh rồi redirect về FRONTEND_URL
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *     responses:
 *       302:
 *         description: Đăng nhập thành công, redirect về FRONTEND_URL/auth/callback
 *       401:
 *         description: State không hợp lệ / email chưa xác thực
 */
authRouter.get('/google/callback', googleCallback)

authRouter.post('/google/one-tap', authRateLimiter, googleOneTap)
