/* eslint-disable max-len */
import { Router } from 'express'
import { validateBody } from '../../shared/validators/validator.js'
import {
  loginSchema,
  registerSchema
} from './auth.schema.js'
import { authMiddleware } from './auth.middleware.js'
import { login, register, refreshToken, logout, googleCallback, googleRedirect, googleOneTap } from './auth.controller.js'
import { authRateLimiter } from '../../shared/middlewares/rate.limit.middleware.js'

export const authRouter: Router = Router()

authRouter.post('/login', validateBody(loginSchema), authRateLimiter, login)

authRouter.post('/register', validateBody(registerSchema), authRateLimiter, register)

authRouter.post('/refresh', refreshToken)

authRouter.post('/logout', authMiddleware, logout)

authRouter.get('/google', authRateLimiter, googleRedirect)

authRouter.get('/google/callback', googleCallback)

authRouter.post('/google/one-tap', authRateLimiter, googleOneTap)

/**
 * @openapi
 * tags:
 *   - name: Authentication
 *     description: Register, login, token refresh, logout, Google OAuth
 *
 * /auth/register:
 *   post:
 *     summary: Register a new account
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, fullname]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password, minLength: 8 }
 *               fullname: { type: string, minLength: 2, maxLength: 100 }
 *               phone: { type: string, description: "optional, 7-15 digits (regex ^\\+?[0-9]{7,15}$)" }
 *     responses:
 *       201:
 *         description: Registered. Sets accessToken and refreshToken HttpOnly cookies.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object, properties: { user: { $ref: '#/components/schemas/User' } } }
 *       400: { description: Validation error }
 *       409: { description: Email or phone already registered }
 *
 * /auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Logged in. Sets accessToken and refreshToken HttpOnly cookies.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object, properties: { user: { $ref: '#/components/schemas/User' } } }
 *       401: { description: Invalid credentials }
 *       403: { description: Account deactivated }
 *
 * /auth/refresh:
 *   post:
 *     summary: Rotate the access token using the refresh cookie
 *     tags: [Authentication]
 *     security: [ { cookieAuth: [] } ]
 *     responses:
 *       200:
 *         description: New tokens set as cookies and echoed in the body
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object, properties: { accessToken: { type: string }, refreshToken: { type: string } } }
 *       401: { description: Invalid or expired refresh token }
 *
 * /auth/logout:
 *   post:
 *     summary: Revoke tokens and clear cookies
 *     tags: [Authentication]
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
 *                     data: { type: object, properties: { message: { type: string } } }
 *
 * /auth/google:
 *   get:
 *     summary: Start Google OAuth (redirect to Google consent)
 *     tags: [Authentication]
 *     responses:
 *       302: { description: Redirect to Google }
 *
 * /auth/google/callback:
 *   get:
 *     summary: Google OAuth callback; sets cookies then redirects to FRONTEND_URL/auth/callback
 *     tags: [Authentication]
 *     parameters:
 *       - { in: query, name: code, schema: { type: string } }
 *       - { in: query, name: state, schema: { type: string } }
 *     responses:
 *       302: { description: Redirect to FRONTEND_URL/auth/callback (on error, ?error=...) }
 *       401: { description: Invalid state or unverified email }
 *
 * /auth/google/one-tap:
 *   post:
 *     summary: Google One Tap sign-in
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [credential]
 *             properties:
 *               credential: { type: string, description: Google ID token from One Tap }
 *     responses:
 *       200:
 *         description: Signed in, cookies set
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object, properties: { user: { $ref: '#/components/schemas/User' } } }
 */
