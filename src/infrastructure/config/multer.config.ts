import multer from 'multer'

// Limit allowed MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
]

// Limit file size (20MB)
const MAX_FILE_SIZE = 20 * 1024 * 1024

const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new Error(
        `File type not supported. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`
      )
    )
  }

  cb(null, true)
}

export const uploadMiddleware = multer({
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
})
