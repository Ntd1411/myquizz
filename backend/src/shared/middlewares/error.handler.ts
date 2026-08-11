/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../errors/AppError.js'
import z from 'zod'
import { fail } from '../utils/response.js'

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('Error:', err)

  // AppError instances
  if (err instanceof AppError) {
    return fail(res, err.message, err.details || null, err.statusCode)
  }

  // Zod validation errors
  if (err instanceof z.ZodError) {
    const fieldErrors = err.issues.reduce(
      (acc, issue) => {
        const field = issue.path.join('.')
        acc[field] = issue.message
        return acc
      },
      {} as Record<string, string>
    )
    return fail(res, 'Validation error', fieldErrors, 400)
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return fail(res, 'File too large. Maximum size is 20MB', null, 413)
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return fail(res, 'Invalid field name', null, 400)
  }
  if (err.message?.includes('File type not supported')) {
    return fail(res, 'File type not supported', null, 400)
  }

  // Database errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    return fail(res, 'Service unavailable', null, 503)
  }

  // Default error
  return fail(res, 'Internal server error', null, 500)
}
