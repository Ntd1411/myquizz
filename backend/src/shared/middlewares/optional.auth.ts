import type { Response, NextFunction } from 'express'
import { verifyToken } from '../../modules/auth/auth.utils.js'
import type { AuthRequest } from '../../modules/auth/auth.type.js'
import { authRepository } from '../../modules/auth/auth.repository.js'
import { userRepository } from '../../modules/user/user.repository.js'

export async function optionalAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Đọc token từ cookie
    const token = req.cookies.accessToken as string | undefined

    if (!token) {
      return next()
    }

    // Check if token is blacklisted
    const isBlacklisted = await authRepository.isTokenBlacklisted(token)

    if (isBlacklisted) {
      return next()
    }

    const decoded = verifyToken(token, 'access')

    if (!decoded || decoded.type !== 'access' || !decoded.userId) {
      return next()
    }

    const user = await userRepository.findById(decoded.userId)

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
