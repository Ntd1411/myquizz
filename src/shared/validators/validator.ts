import type { Request, Response, NextFunction } from 'express'
import z from 'zod'

export function validateBody(schema: z.ZodType) {
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

export function validateQuery<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.parse(req.query)
      // @ts-expect-error - validatedQuery is added dynamically
      req.validatedQuery = result
      next()
    } catch (error) {
      next(error)
    }
  }
}
