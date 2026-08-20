/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../errors/AppError.js'
import z from 'zod'
import { fail } from '../utils/response.js'

/**
 * Turns anything thrown in a handler into a coded response.
 *
 * Everything worth reading about the failure is logged here and nowhere else. The
 * response itself carries a code and a status, because the client writes the
 * sentence: an API that ships English prose cannot be translated by its consumer.
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // AppError instances
  if (err instanceof AppError) {
    // An expected refusal is not a defect: log the reason, not a stack trace.
    console.warn(`${err.code} on ${req.method} ${req.originalUrl}: ${err.message}`)
    return fail(res, err.code, err.statusCode)
  }

  console.error(`Error on ${req.method} ${req.originalUrl}:`, err)

  // Zod validation errors. The per-field reasons stay in the log: the client already
  // validates the same shapes, so a body that fails here is a client bug, not
  // something to explain to whoever is holding the phone.
  if (err instanceof z.ZodError) {
    const fieldErrors = err.issues.reduce(
      (acc, issue) => {
        const field = issue.path.join('.')
        acc[field] = issue.message
        return acc
      },
      {} as Record<string, string>
    )
    console.warn('Validation failed:', fieldErrors)
    return fail(res, 'VALIDATION_ERROR', 400)
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return fail(res, 'FILE_TOO_LARGE', 413)
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return fail(res, 'FILE_FIELD_INVALID', 400)
  }
  if (err.message?.includes('File type not supported')) {
    return fail(res, 'FILE_TYPE_UNSUPPORTED', 400)
  }

  // Database errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    return fail(res, 'SERVICE_UNAVAILABLE', 503)
  }

  // Default error
  return fail(res, 'SERVER_ERROR', 500)
}
