import { codeForStatus, type ErrorCode } from './codes.js'

/**
 * A failure the API is willing to describe to the caller.
 *
 * `message` never leaves the process: it is written for whoever reads the logs, and
 * it is free to name a row id, a mode or an internal rule. Only `code` and
 * `statusCode` reach the client, and the client turns the code into a sentence in
 * the reader's own language.
 *
 * The code is optional so that a throw site which has nothing more specific to say
 * than its status still produces a usable response, but pass one whenever the caller
 * could react to this failure differently from its neighbours.
 */
export class AppError extends Error {
  public code: ErrorCode

  constructor(
    public statusCode: number,
    message: string,
    code?: ErrorCode
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code ?? codeForStatus(statusCode)
  }
}
