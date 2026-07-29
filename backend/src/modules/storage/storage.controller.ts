import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../shared/types/shared.types.js'
import { AppError } from '../../shared/errors/AppError.js'
import {
  createPresignedUploadService
} from './storage.service.js'
import type { PresignUploadInput } from './storage.schemas.js'

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

    res.json(result)
  } catch (error) {
    next(error)
  }
}
