import { Router } from 'express'
import { authMiddleware } from '../auth/auth.middleware.js'
import { validateBody } from '../../shared/validators/validator.js'
import { presignUpload } from './storage.controller.js'
import { presignUploadSchema } from './storage.schema.js'
import { uploadRateLimiter } from '../../shared/middlewares/rate.limit.middleware.js'

export const storageRouter: Router = Router()

storageRouter.post( '/presign', authMiddleware, uploadRateLimiter, validateBody(presignUploadSchema), presignUpload)
