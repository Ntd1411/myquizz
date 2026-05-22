import type { Request, Response, NextFunction } from 'express'
import Joi from 'joi'
import { AppError } from '../errors/AppError.js'

export function validate(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    })
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
      throw new AppError(400, 'Validation error', errors)
    }
    
    // Replace body với validated value
    req.body = value
    next()
  }
}