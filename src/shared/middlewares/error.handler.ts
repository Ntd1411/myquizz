/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../errors/AppError.js'
import z from 'zod'

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // console.error("Error:", err);

  // AppError instances
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details && { details: err.details })
    })
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
    return res.status(400).json({ error: 'Validation error', details: fieldErrors })
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res
      .status(413)
      .json({ error: 'File too large. Maximum size is 20MB' })
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Field name không hợp lệ' })
  }
  if (err.message?.includes('File type not supported')) {
    return res.status(400).json({ error: err.message })
  }

  // Database errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    return res.status(503).json({ error: 'Service unavailable' })
  }

  // Default error
  return res.status(500).json({ error: 'Internal server error' })
}
