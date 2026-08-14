import { http } from './http'
import { unwrap } from './envelope'

/*
 * Mirrors backend/src/modules/storage/storage.schema.ts. Presign rejects anything
 * outside these values with a 400, so the same rules are checked here first: a
 * rejected file then costs no round trip and the user gets a precise message
 * instead of a generic validation error.
 */
const MIN_FILE_SIZE = 1
const MAX_FILE_SIZE = 2 * 1024 * 1024
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]
const ALLOWED_FOLDERS = ['avatars', 'quizzes', 'questions', 'uploads']

/** Ready to drop into an <input type="file" accept="..."> attribute. */
export const IMAGE_ACCEPT = ALLOWED_MIME_TYPES.join(',')

export const MAX_IMAGE_SIZE = MAX_FILE_SIZE

/**
 * Validates a file against the presign rules.
 * Returns an error message to display, or null when the file is accepted.
 */
export function checkImageFile(file) {
  if (!file) {
    return 'Pick an image first.'
  }

  // An empty type usually means the browser could not detect the format, which
  // presign would reject anyway.
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return 'Only JPG, PNG, GIF and WEBP images are allowed.'
  }

  if (file.size < MIN_FILE_SIZE) {
    return 'That image file is empty.'
  }

  if (file.size > MAX_FILE_SIZE) {
    return 'The image exceeds the 2MB limit.'
  }

  return null
}

/**
 * Step 1 of the image flow: ask the backend for a presigned S3 URL.
 * NOTE: the payload is nested under data.presignedUrl, not directly on data.
 */
export async function presignUpload({ contentType, folder, fileSize }, { signal } = {}) {
  const res = await http.post(
    '/storage/presign',
    { contentType, folder, fileSize },
    { signal },
  )
  return unwrap(res.data).presignedUrl // { uploadUrl, publicUrl, key }
}

/**
 * Full image upload flow: validate -> presign -> PUT the raw file -> public URL.
 * `folder` must be one of: avatars | quizzes | questions | uploads
 * Pass an AbortSignal to cancel an upload the user walked away from.
 */
export async function uploadImage(file, folder, { signal } = {}) {
  if (!ALLOWED_FOLDERS.includes(folder)) {
    throw new Error(`Unknown upload folder: ${folder}`)
  }

  const problem = checkImageFile(file)
  if (problem) {
    throw new Error(problem)
  }

  const { uploadUrl, publicUrl } = await presignUpload(
    {
      contentType: file.type,
      folder,
      fileSize: file.size,
    },
    { signal },
  )

  // The presigned URL expires after 5 minutes and must be called WITHOUT credentials,
  // otherwise the S3 signature check fails.
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
    signal,
  })

  // fetch only rejects on a network error, so a 403 from an expired signature
  // would otherwise be stored as a broken image URL.
  if (!res.ok) {
    throw new Error(`The image upload failed (${res.status}). Please try again.`)
  }

  return publicUrl
}
