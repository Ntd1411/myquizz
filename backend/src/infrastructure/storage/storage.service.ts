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

export class DigitalOceanStorageService implements IStorageService {
  private client: S3Client
  private bucketName: string

  constructor() {
    this.client = new S3Client({
      endpoint: storageConfig.endpoint,
      region: storageConfig.region,
      credentials: storageConfig.credentials
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
    const publicUrl = storageConfig.publicUrl || `${storageConfig.endpoint}/${this.bucketName}`
    return `${publicUrl}/${key}`
  }

  private extractKeyFromUrl(fileUrl: string): string | undefined {
    try {
      const url = new URL(fileUrl)
      const pathname = url.pathname

      return pathname.startsWith('/') ? pathname.slice(1) : pathname
    } catch {
      return undefined
    }
  }
}

export const storageService = new DigitalOceanStorageService()
