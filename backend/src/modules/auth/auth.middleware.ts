import type { Response, NextFunction } from 'express'
import { verifyToken } from './auth.utils.js'
import { AppError } from '../../shared/errors/AppError.js'
import type { AuthRequest } from './auth.type.js'
import { authRepository } from './auth.repository.js'
import { userRepository } from '../user/user.repository.js'

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Đọc token từ cookie thay vì Authorization header
    const token = req.cookies.accessToken as string | undefined

    if (!token) {
      throw new AppError(401, 'Access token missing')
    }

    // Check if token is blacklisted
    const isBlacklisted = await authRepository.isTokenBlacklisted(token)

    if (isBlacklisted) {
      throw new AppError(401, 'Token is blacklisted')
    }

    const decoded = verifyToken(token, 'access')

    if (!decoded || decoded.type !== 'access' || !decoded.userId) {
      throw new AppError(401, 'Invalid access token')
    }

    const user = await userRepository.findById(decoded.userId)

    if (!user) {
      throw new AppError(401, 'Invalid access token')
    }

    if (user.deleted_at !== null) {
      throw new AppError(403, 'Account is deactivated')
    }

    req.token = token
    req.user = user
    next()
  } catch (error) {
    next(error)
  }
}
