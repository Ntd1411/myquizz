import type { Response, NextFunction } from 'express'
import { verifyToken } from '../../shared/utils/auth.utils.js'
import { sharedRepository } from '../../shared/repositories/shared.repository.js'
import { type AuthRequest } from '../../shared/types/shared.types.js'

export async function optionalAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next()
    }

    const token = authHeader.substring(7)

    if (!token) {
      return next()
    }

    // Check if token is blacklisted
    const isBlacklisted = await sharedRepository.isTokenBlacklisted(token)

    if (isBlacklisted) {
      return next()
    }

    const decoded = verifyToken(token, 'access')

    if (!decoded || decoded.type !== 'access' || !decoded.userId) {
      return next()
    }

    const user = await sharedRepository.findById(decoded.userId)

    if (!user) {
      return next()
    }

    if (user.deleted_at !== null) {
      return next()
    }

    req.token = token
    req.user = user
    next()
  } catch (error) {
    next(error)
  }
}
