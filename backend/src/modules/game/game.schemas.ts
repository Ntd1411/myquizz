import z from 'zod'

export const createGameSchema = z.object({
  quiz_id: z.number().positive(),
  session_name: z.string().min(2).max(100)
})

export const joinGameSchema = z.object({
  player_name: z.string().min(2).max(50),
  player_id: z.number().positive().optional()
})

export type CreateGameRequest = z.infer<typeof createGameSchema>
export type JoinGameRequest = z.infer<typeof joinGameSchema>
