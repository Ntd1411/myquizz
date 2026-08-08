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

/**
 * Validates req.params against a schema.
 *
 * Path parameters used to reach handlers as raw strings, so `Number('abc')`
 * produced NaN and travelled all the way into SQL. The parsed result is exposed
 * as req.validatedParams rather than written back to req.params, because Express
 * owns that object and its values are typed as strings.
 */
export function validateParams<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.parse(req.params)
      // @ts-expect-error - validatedParams is added dynamically
      req.validatedParams = result
      next()
    } catch (error) {
      next(error)
    }
  }
}
