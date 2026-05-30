import type { Request, Response, NextFunction } from 'express'
import Joi from 'joi'
import { AppError } from '../errors/AppError.js'

export function validate(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true
      })

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const { error, value } = result

      if (error) {
        const errors = error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
        throw new AppError(400, 'Validation error', errors)
      }

      // Replace body với validated value
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      req.body = value
      next()
    } catch (error) {
      next(error)
    }
  }
}
