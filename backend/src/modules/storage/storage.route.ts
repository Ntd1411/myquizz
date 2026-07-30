/* eslint-disable max-len */
import { Router } from 'express'
import { authMiddleware } from '../auth/auth.middleware.js'
import { validateBody } from '../../shared/validators/validator.js'
import { presignUpload } from './storage.controller.js'
import { presignUploadSchema } from './storage.schema.js'
import { uploadRateLimiter } from '../../shared/middlewares/rate.limit.middleware.js'

export const storageRouter: Router = Router()

storageRouter.post( '/presign', authMiddleware, uploadRateLimiter, validateBody(presignUploadSchema), presignUpload)

/**
 * @openapi
 * tags:
 *   - name: Storage
 *     description: Presigned direct-to-object-storage uploads
 *
 * /storage/presign:
 *   post:
 *     summary: Get a presigned URL for a direct upload
 *     description: Upload URL is valid for 5 minutes. Object key format is {folder}/{userId}/{uuid}. Max size 2MB.
 *     tags: [Storage]
 *     security: [ { cookieAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contentType, folder, fileSize]
 *             properties:
 *               contentType: { type: string, enum: [image/jpeg, image/jpg, image/png, image/gif, image/webp] }
 *               folder: { type: string, enum: [avatars, quizzes, questions, uploads] }
 *               fileSize: { type: number, minimum: 1, maximum: 2097152, description: bytes, max 2MB }
 *     responses:
 *       200:
 *         description: Result nested under data.presignedUrl
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object, properties: { presignedUrl: { $ref: '#/components/schemas/PresignResult' } } }
 *       400: { description: Invalid folder or size over the 2MB limit }
 *       401: { description: Not authenticated }
 */
