import type { CreateQuestionRequest, CreateQuizRequest } from '../../shared/validators/schemas.js'

export interface Quiz extends CreateQuizRequest {
  id: number
  quiz_owner: number
  quiz_name: string
  quiz_description?: string
  quiz_language: string
  quiz_image?: string
  quiz_category?: string
  is_public: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  questions: Question[]
}

export interface Question extends CreateQuestionRequest {
  id: number
  quiz_id: number
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasPreviousPage: boolean
    hasNextPage: boolean
  }
}
