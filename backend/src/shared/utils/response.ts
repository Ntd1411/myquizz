import type { Response } from 'express'

export function success(res: Response, data: unknown, meta = {}, status = 200) {
  if (!data) data = null
  return res.status(status).json({
    success: true,
    data: data,
    error: null,
    meta: { timestamp: new Date().toISOString(), ...meta }
  })
}

export function fail(res: Response, message: string, details: unknown = null, status: number = 400) {
  return res.status(status).json({
    success: false,
    data: null,
    error: { message, details },
    meta: { timestamp: new Date().toISOString() }
  })
}
