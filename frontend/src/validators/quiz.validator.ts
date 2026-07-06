import { z } from 'zod'

const baseQuestionSchema = z.object({
  question_type: z.enum(['multiple_choice', 'multiple_select', 'short_answer', 'long_answer']),
  question_text: z.string().min(1, 'Question must be at least 1 character').max(200, 'Question must be at most 200 characters'),
  time_limit: z.number().min(0, 'Time limit must be a positive number').default(30),
  question_image: z.string().url('Must be valid URL').optional()
})

const correctAnswerObjectSchema = z.object({
  option_text: z.string().min(1, 'Correct answer must be at least 1 character').max(100, 'Correct answer must be at most 100 characters'),
  hint: z.string().max(200, 'Hint must be at most 200 characters').optional(),
  explanation: z.string().max(500, 'Explanation must be at most 500 characters').optional()
})

const correctAnswerArraySchema = z.array(correctAnswerObjectSchema)

export const createQuestionSchema = baseQuestionSchema.extend({
  answer_options: z.array(
    z.object({
      option_text: z.string().min(1, 'Option must be at least 1 character').max(100, 'Option must be at most 100 characters')
    })
  ).optional(),
  correct_answer: z.union([correctAnswerObjectSchema, correctAnswerArraySchema])
}).superRefine((data, ctx) => {
  // For multiple choice/select, answer_options is required
  if (data.question_type === 'multiple_choice' || data.question_type === 'multiple_select') {
    if (!data.answer_options || data.answer_options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Question must have at least 2 options',
        path: ['answer_options']
      })
    }
    
    // For multiple_choice, correct_answer must be object
    if (data.question_type === 'multiple_choice' && Array.isArray(data.correct_answer)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Multiple choice must have single correct answer',
        path: ['correct_answer']
      })
    }
    
    // For multiple_select, correct_answer must be array
    if (data.question_type === 'multiple_select' && !Array.isArray(data.correct_answer)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Multiple select must have array of correct answers',
        path: ['correct_answer']
      })
    }
  }
  
  // For short/long answer, correct_answer must be object
  if ((data.question_type === 'short_answer' || data.question_type === 'long_answer') && Array.isArray(data.correct_answer)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Short/long answer must have single correct answer',
      path: ['correct_answer']
    })
  }
})

export const createQuizSchema = z.object({
  quiz_name: z.string().min(3, 'Quiz name at least 3 chars').max(100, 'Quiz name must be at most 100 characters'),
  quiz_description: z.string().max(500, 'Quiz description must be at most 500 characters').optional(),
  quiz_language: z.string().min(1, 'Language is required'),
  quiz_image: z.string().url('Must be valid URL').optional(),
  quiz_category: z.string().max(50, 'Quiz category must be at most 50 characters').optional(),
  is_public: z.boolean(),
  questions: z.array(createQuestionSchema).min(1, 'Quiz must have at least 1 question')
})

export const updateQuizSchema = createQuizSchema.partial()

export const searchQuizzesSchema = z.object({
  keyword: z.string().trim().max(200).optional(),
  language: z.string().trim().max(50).optional(),
  category: z.string().trim().max(50).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(20).default(10)
})

export const listQuizzesSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(20).default(10)
})

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>
export type CreateQuizInput = z.infer<typeof createQuizSchema>
export type UpdateQuizInput = z.infer<typeof updateQuizSchema>
export type SearchQuizzesInput = z.infer<typeof searchQuizzesSchema>
export type ListQuizzesInput = z.infer<typeof listQuizzesSchema>
