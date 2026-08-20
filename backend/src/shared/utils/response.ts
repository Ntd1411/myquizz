import type { Response } from 'express'
import type { ErrorCode } from '../errors/codes.js'

export function success(res: Response, data: unknown = null, status = 200, meta = {}) {
  if (!data) data = null
  return res.status(status).json({
    success: true,
    data: data,
    error: null,
    meta: { timestamp: new Date().toISOString(), ...meta }
  })
}

/**
 * The only way this API reports a failure: a status and a code.
 *
 * No message and no field dump. Prose written here would be English, would end up on
 * a screen that has to speak another language, and would leak internals - a mode
 * name, a row id, which of two lookups missed. The reason is logged instead, where
 * developers can read it and users cannot.
 */
export function fail(res: Response, code: ErrorCode, status: number = 400) {
  return res.status(status).json({
    success: false,
    data: null,
    error: { code },
    meta: { timestamp: new Date().toISOString() }
  })
}
