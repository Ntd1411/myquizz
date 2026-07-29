import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'
import { storageConfig } from '../../infrastructure/config/storage.js'
import { AppError } from '../../shared/errors/AppError.js'
import { ALLOWED_FOLDERS, MAX_FILE_SIZE, type AllowedFolder } from './storage.schemas.js'

// S3 client
const s3Client = new S3Client({
  endpoint: storageConfig.endpoint,
  region: storageConfig.region,
  credentials: storageConfig.credentials,
  forcePathStyle: true
})

const bucketName = storageConfig.bucket

// Get public url
function getPublicUrl(key: string): string {
  const encodedKey = encodeURIComponent(key)

  // Oracle Cloud needs %2F; other providers (DigitalOcean Spaces, R2) use /
  const isOracleCloud = storageConfig.endpoint.includes('oraclecloud.com')
  const finalKey = isOracleCloud
    ? encodedKey
    : encodedKey.replace(/%2F/g, '/')

  if (storageConfig.publicUrl) {
    return `${storageConfig.publicUrl}/${finalKey}`
  }

  return `${storageConfig.endpoint}/${bucketName}/${finalKey}`
}

// Extract key from public URL
function extractKeyFromUrl(fileUrl: string): string | undefined {
  try {
    const url = new URL(fileUrl)
    const pathname = url.pathname

    // Oracle Cloud format: /n/{namespace}/b/{bucket}/o/{key}
    const oracleMatch = pathname.match(/\/n\/[^/]+\/b\/[^/]+\/o\/(.+)/)
    if (oracleMatch && oracleMatch[1]) {
      return decodeURIComponent(oracleMatch[1])
    }

    // DigitalOcean Spaces format: /{key}
    return pathname.startsWith('/') ? pathname.slice(1) : pathname
  } catch {
    return undefined
  }
}

// Check if the folder is allowed
function assertAllowedFolder(folder: string): void {
  if (!ALLOWED_FOLDERS.includes(folder as AllowedFolder)) {
    throw new AppError(
      400,
      `Invalid folder. Allowed: ${ALLOWED_FOLDERS.join(', ')}`
    )
  }
}

/**
 * Create a presigned URL for uploading a file directly to object storage.
 * The URL is valid for 5 minutes.
 * The file will be stored in the format: {folder}/{userId}/{uuid}.{extension}
 * The file will be publicly accessible after upload.
 */
export async function createPresignedUploadService(
  contentType: string,
  folder: string,
  fileSize: number,
  userId: number
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  assertAllowedFolder(folder)

  if (fileSize > MAX_FILE_SIZE) {
    throw new AppError(400, `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`)
  }

  // Create a unique key for the file
  const key = `${folder}/${userId}/${uuidv4()}`

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
    ContentLength: fileSize,
    ACL: 'public-read'
  })

  // URL valid for 5 minutes (300 seconds)
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 })

  return { uploadUrl, publicUrl: getPublicUrl(key), key }
}

/**
* Delete a file from object storage using its public URL.
* The file will be permanently deleted.
 */
export async function deleteFileService(fileUrl: string): Promise<void> {
  if (!fileUrl) {
    console.log('fileUrl is required')
    return
  }

  const key = extractKeyFromUrl(fileUrl)
  if (!key) {
    console.log(`Cannot extract key from URL: ${fileUrl}`)
    return
  }

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key
  })

  await s3Client.send(command)
}
