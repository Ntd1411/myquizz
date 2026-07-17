import { z } from 'zod'

export const createQuestionSchema = z.object({
  question_type: z.enum(['multiple_choice', 'multiple_select', 'short_answer', 'long_answer']),
  question_text: z.string().min(1, 'Question must be at least 1 character').max(200, 'Question must be at most 200 characters'),
  time_limit: z.number().min(0, 'Time limit must be a positive number').default(30),
  question_image: z.url('Must be valid URL').optional(),
  answer_options: z.array(z.string().min(1, 'Option must be at least 1 character').max(100, 'Option must be at most 100 characters'))
    .min(2, 'Question must have at least 2 options')
    .max(4, 'Question can have at most 4 options').optional(),
  correct_answer: z.union([
    z.array(z.number().int().min(0)).min(1, 'At least one correct answer is required'),
    z.string().min(1, 'Correct answer is required')])
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

export type UpdateQuizRequest = z.infer<typeof updateQuizSchema>
export type CreateQuizRequest = z.infer<typeof createQuizSchema>
export type CreateQuestionRequest = z.infer<typeof createQuestionSchema>
