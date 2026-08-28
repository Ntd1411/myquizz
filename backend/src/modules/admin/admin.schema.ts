import z from 'zod'
import { intQuery } from '../quiz/quiz.schema.js'

export const AdminSchema = z.object({
  offset: intQuery(0, Number.MAX_SAFE_INTEGER).optional(),
  limit: intQuery(1, 100).optional()
})
