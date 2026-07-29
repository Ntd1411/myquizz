import { z } from 'zod'

// Folder whitelist
export const ALLOWED_FOLDERS = [
  'avatars',
  'quizzes',
  'questions',
  'uploads'
] as const

export type AllowedFolder = (typeof ALLOWED_FOLDERS)[number]

// MIME type whitelist
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
] as const

// File size limit (2MB)
export const MAX_FILE_SIZE = 2 * 1024 * 1024

// Validate body when requesting presigned URL (direct upload to cloud)
export const presignUploadSchema = z.object({
  contentType: z.enum(ALLOWED_MIME_TYPES),
  folder: z.enum(ALLOWED_FOLDERS),
  fileSize: z.number().min(1, 'fileSize must be greater than 0').max(MAX_FILE_SIZE, `fileSize must not exceed ${MAX_FILE_SIZE / 1024 / 1024}MB`)
})

export type PresignUploadInput = z.infer<typeof presignUploadSchema>
