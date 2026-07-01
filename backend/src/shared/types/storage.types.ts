export interface IStorageService {
  upload(file: Express.Multer.File, path: string): Promise<string>
  delete(fileUrl: string): Promise<void>
}

export interface UploadOptions {
  folder: string // "users", "quizzes", etc
  fileName?: string
  isPublic?: boolean
}

export interface UploadResponse {
  success: boolean
  url: string
  size: number
  uploadedAt: Date
}
