import { z } from 'zod'
import apiClient from '@/lib/api-client'

// Types
export interface Question {
  id: number
  quiz_id: number
  question_text: string
  question_type: 'single' | 'multiple' | 'true_false'
  question_image?: string
  question_time_limit: number
  question_points: number
  answers: Answer[]
  created_at: string
  updated_at: string
}

export interface Answer {
  id: number
  answer_text: string
  is_correct: boolean
}

export interface Quiz {
  id: number
  quiz_owner: number
  quiz_name: string
  quiz_description?: string
  quiz_language: string
  quiz_image?: string
  quiz_category?: string
  is_public: boolean
  created_at: string
  updated_at: string
  questions: Question[]
  owner?: {
    user_id: number
    fullname: string
  }
}

export interface PaginatedQuizResponse {
  data: Quiz[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasPreviousPage: boolean
    hasNextPage: boolean
  }
}

export interface SearchQuizParams {
  keyword?: string
  language?: string
  category?: string
  page?: number
  limit?: number
}

// Validation schemas
export const searchQuizSchema = z.object({
  keyword: z.string().trim().max(200).optional(),
  language: z.string().trim().max(50).optional(),
  category: z.string().trim().max(50).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(20).default(10)
})

export type SearchQuizInput = z.infer<typeof searchQuizSchema>

// Quiz Service
export const quizService = {
  async searchQuizzes(params: SearchQuizParams): Promise<PaginatedQuizResponse> {
    const response = await apiClient.get<PaginatedQuizResponse>('/quizzes/search', {
      params: {
        keyword: params.keyword || undefined,
        language: params.language || undefined,
        category: params.category || undefined,
        page: params.page || 1,
        limit: params.limit || 10
      }
    })
    return response.data
  },

  async getQuizById(quizId: string): Promise<Quiz> {
    const response = await apiClient.get<Quiz>(`/quizzes/id/${quizId}`)
    return response.data
  },

  async getUserQuizzes(userId: string, page = 1, limit = 10): Promise<PaginatedQuizResponse> {
    const response = await apiClient.get<PaginatedQuizResponse>(`/quizzes/users/id/${userId}`, {
      params: { page, limit }
    })
    return response.data
  }
}
