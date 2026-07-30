import type { Response, NextFunction } from 'express'
import { AppError } from '../../shared/errors/AppError.js'
import {
  createPresignedUploadService
} from './storage.service.js'
import type { PresignUploadInput } from './storage.schema.js'
import type { AuthRequest } from '../auth/auth.type.js'
import { success } from '../../shared/utils/response.js'

// Controller for presigning upload requests
export async function presignUpload(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { contentType, folder, fileSize } = req.body as PresignUploadInput

    if (!contentType || !folder || !fileSize) {
      throw new AppError(400, 'contentType, folder and fileSize are required')
    }

    const result = await createPresignedUploadService(
      contentType,
      folder,
      fileSize,
      req.user?.id as number
    )

    return success(res, { presignedUrl: result })
  } catch (error) {
    next(error)
  }
}
