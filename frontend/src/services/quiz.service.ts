import apiClient from '@/lib/api-client'
import type { Quiz, PaginatedQuizResponse, SearchQuizParams } from '@/types/quiz.types'
import { createQuizSchema, updateQuizSchema, searchQuizzesSchema, type CreateQuizInput, type UpdateQuizInput } from '@/validators/quiz.validator'

export type { Quiz, PaginatedQuizResponse, SearchQuizParams } from '@/types/quiz.types'

// Quiz Service
export const quizService = {
  async searchQuizzes(params: SearchQuizParams): Promise<PaginatedQuizResponse> {
    const validatedParams = searchQuizzesSchema.parse({
      keyword: params.keyword,
      language: params.language,
      category: params.category,
      page: params.page || 1,
      limit: params.limit || 10
    })

    const response = await apiClient.get<PaginatedQuizResponse>('/quizzes/search', {
      params: {
        keyword: validatedParams.keyword || undefined,
        language: validatedParams.language || undefined,
        category: validatedParams.category || undefined,
        page: validatedParams.page,
        limit: validatedParams.limit
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
  },

  async createQuiz(quizData: CreateQuizInput): Promise<Quiz> {
    const validatedData = createQuizSchema.parse(quizData)
    const response = await apiClient.post<Quiz>('/quizzes/', validatedData)
    return response.data
  },

  async updateQuiz(quizId: string, quizData: UpdateQuizInput): Promise<Quiz> {
    const validatedData = updateQuizSchema.parse(quizData)
    const response = await apiClient.patch<Quiz>(`/quizzes/id/${quizId}`, validatedData)
    return response.data
  },

  async deleteQuiz(quizId: string): Promise<void> {
    await apiClient.delete(`/quizzes/id/${quizId}`)
  }
}
