import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email('Email must be valid'),
  password: z.string().min(1, 'Password is required')
})

export const registerSchema = z.object({
  email: z.email('Email must be valid'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullname: z.string().min(2, 'Full name must be at least 2 characters').max(100, 'Full name must be at most 100 characters'),
  phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'Phone must be 7-15 digits').optional()
})

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(8, 'Password must be at least 8 characters'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
})

export const updateProfileSchema = z.object({
  fullname: z.string().min(2, 'Full name must be at least 2 characters').max(100, 'Full name must be at most 100 characters').optional(),
  email: z.email('Email must be valid').optional(),
  phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'Phone must be 7-15 digits').optional(),
  description: z.string().max(200, 'Description must be at most 200 characters').optional()
})

export const deactivateAccountSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters')
})

export const createQuestionSchema = z.object({
  question_type: z.enum(['multiple_choice', 'multiple_select', 'short_answer', 'long_answer']),
  question_text: z.string().min(5, 'Question must be at least 5 characters').max(200, 'Question must be at most 200 characters'),
  question_image: z.url('Must be valid URL').optional(),
  answer_options: z.array(
    z.object({
      option_text: z.string().min(2, 'Option must be at least 2 characters').max(100, 'Option must be at most 100 characters')
    })
  ).min(2, 'Question must have at least 2 options').optional(),
  correct_answer: z.union([
    z.object({
      option_text: z.string().min(2, 'Correct answer must be at least 2 characters').max(100, 'Correct answer must be at most 100 characters'),
      hint: z.string().max(200, 'Hint must be at most 200 characters').optional(),
      explanation: z.string().max(500, 'Explanation must be at most 500 characters').optional()
    }),
    z.array(
      z.object({
        option_text: z.string().min(2, 'Correct answer must be at least 2 characters').max(100, 'Correct answer must be at most 100 characters'),
        hint: z.string().max(200, 'Hint must be at most 200 characters').optional(),
        explanation: z.string().max(500, 'Explanation must be at most 500 characters').optional()
      })
    )
  ])
})

export const createQuizSchema = z.object({
  quiz_name: z.string().min(3, 'Quiz name at least 3 chars').max(100, 'Quiz name must be at most 100 characters'),
  quiz_description: z.string().max(500, 'Quiz description must be at most 500 characters').optional(),
  quiz_language: z.string().min(1, 'Language is required'),
  quiz_image: z.url('Must be valid URL').optional(),
  quiz_category: z.string().max(50, 'Quiz category must be at most 50 characters').optional(),
  is_public: z.boolean(),
  questions: z.array(createQuestionSchema).min(1, 'Quiz must have at least 1 question')
})

export const searchQuizzesSchema = z.object({
  keyword: z.string().trim().max(200).optional(),
  language: z.string().trim().max(50).optional(),
  category: z.string().trim().max(50).optional(),
  page: z.string().regex(/^\d+$/).transform(Number)
    .pipe(z.number().int().min(1)).default(1),
  limit: z.string().regex(/^\d+$/).transform(Number)
    .pipe(z.number().int().min(1).max(20)).default(10)
})

export const listQuizzesSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number)
    .pipe(z.number().int().min(1)).default(1),
  limit: z.string().regex(/^\d+$/).transform(Number)
    .pipe(z.number().int().min(1).max(20)).default(10)
})

export const updateQuizSchema = createQuizSchema.partial()

export type LoginRequest = z.infer<typeof loginSchema>
export type RegisterRequest = z.infer<typeof registerSchema>
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>
export type DeactivateAccountRequest = z.infer<typeof deactivateAccountSchema>
export type CreateQuestionRequest = z.infer<typeof createQuestionSchema>
export type CreateQuizRequest = z.infer<typeof createQuizSchema>
export type UpdateQuizRequest = z.infer<typeof updateQuizSchema>
