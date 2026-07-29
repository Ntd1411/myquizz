import { type IStorageService } from '../../shared/types/storage.types.js'
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3'
import { storageConfig } from '../config/storage.js'
import { v4 as uuidv4 } from 'uuid'
import type {} from 'multer'
import { AppError } from '../../shared/errors/AppError.js'

export class StorageService implements IStorageService {
  private client: S3Client
  private bucketName: string

  constructor() {
    this.client = new S3Client({
      endpoint: storageConfig.endpoint,
      region: storageConfig.region,
      credentials: storageConfig.credentials,
      forcePathStyle: true
    })
    this.bucketName = storageConfig.bucket
  }

  async upload(file: Express.Multer.File, path: string): Promise<string> {
    const key = `${path}/${uuidv4()}-${file.originalname}`

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read'
    })

    await this.client.send(command)

    return this.getPublicUrl(key)
  }

  async delete(fileUrl: string): Promise<void> {
    const key = this.extractKeyFromUrl(fileUrl)

    if (!key) {
      throw new AppError(500, `Cannot extract key from URL: ${fileUrl}`)
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key
    })

    await this.client.send(command)
  }

  private getPublicUrl(key: string): string {
    const encodedKey = encodeURIComponent(key)

    // Oracle Cloud cần %2F, các provider khác (Cloudflare R2, DigitalOcean Spaces) dùng /
    const isOracleCloud = storageConfig.endpoint.includes('oraclecloud.com')
    const finalKey = isOracleCloud ? encodedKey : encodedKey.replace(/%2F/g, '/')

    if (storageConfig.publicUrl) {
      return `${storageConfig.publicUrl}/${finalKey}`
    }

    return `${storageConfig.endpoint}/${this.bucketName}/${finalKey}`
  }

  private extractKeyFromUrl(fileUrl: string): string | undefined {
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
}

export const storageService = new StorageService()
