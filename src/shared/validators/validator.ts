import type { Request, Response, NextFunction } from 'express'
import z from 'zod'

export function validate(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.parse(req.body)
      req.body = result
      next()
    } catch (error) {
      next(error)
    }
  }
}
