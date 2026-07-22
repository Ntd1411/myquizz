import z from 'zod'

export const createGameSchema = z.object({
  quiz_id: z.number().positive(),
  session_name: z.string().min(2).max(100)
})

export const joinGameSchema = z.object({
  player_name: z.string().min(2).max(50),
  player_id: z.number().positive().optional(),
  player_guest_id: z.number().positive().optional()
})

export const submitAnswerSchema = z.object({
  question_id: z.number().positive(),
  answer_id: z.number().optional(),
  answer_text: z.string().optional(),
  answer_ids: z.array(z.number()).optional(),
  time_taken: z.number().nonnegative()
})

export type CreateGameRequest = z.infer<typeof createGameSchema>
export type JoinGameRequest = z.infer<typeof joinGameSchema>
export type SubmitAnswerRequest = z.infer<typeof submitAnswerSchema>
