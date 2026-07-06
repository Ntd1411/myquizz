// Quiz types matching backend schemas

export type QuestionType = 'multiple_choice' | 'multiple_select' | 'short_answer' | 'long_answer'

export interface AnswerOption {
  option_text: string
}

export interface CorrectAnswer {
  option_text: string
  hint?: string
  explanation?: string
}

export interface CreateQuestionRequest {
  question_type: QuestionType
  question_text: string
  time_limit: number
  question_image?: string
  answer_options?: AnswerOption[]
  correct_answer: CorrectAnswer | CorrectAnswer[]
}

export interface Question {
  id: number
  quiz_id: number
  question_type: QuestionType
  question_text: string
  time_limit: number
  question_image?: string
  answer_options?: AnswerOption[]
  correct_answer: CorrectAnswer | CorrectAnswer[]
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateQuizRequest {
  quiz_name: string
  quiz_description?: string
  quiz_language: string
  quiz_image?: string
  quiz_category?: string
  is_public: boolean
  questions: CreateQuestionRequest[]
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
  questions: Question[]
  deleted_at: string | null
  created_at: string
  updated_at: string
  owner?: {
    id: number
    fullname: string
  }
}

export interface UpdateQuizRequest extends Partial<CreateQuizRequest> {}

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
