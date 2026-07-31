import { http } from './http'
import { unwrap } from './envelope'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // Backend hard limit: 2MB.

/**
 * Step 1 of the image flow: ask the backend for a presigned S3 URL.
 * NOTE: the payload is nested under data.presignedUrl, not directly on data.
 */
export async function presignUpload({ contentType, folder, fileSize }) {
  const res = await http.post('/storage/presign', { contentType, folder, fileSize })
  return unwrap(res.data).presignedUrl // { uploadUrl, publicUrl, key }
}

/**
 * Full image upload flow: presign -> PUT the raw file -> return the public URL.
 * `folder` must be one of: avatars | quizzes | questions | uploads
 */
export async function uploadImage(file, folder) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Ảnh vượt quá 2MB.')
  }

  const { uploadUrl, publicUrl } = await presignUpload({
    contentType: file.type,
    folder,
    fileSize: file.size,
  })

  // The presigned URL expires after 5 minutes and must be called WITHOUT credentials,
  // otherwise the S3 signature check fails.
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })

  return publicUrl
}
