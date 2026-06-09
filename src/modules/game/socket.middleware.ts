import { verifyToken } from '../../shared/utils/auth.utils.js'
import { sharedRepository } from '../../shared/repositories/shared.repository.js'
import type { AuthSocket } from './game.type.js'

export async function socketAuthMiddleware(socket: AuthSocket, next: (err?: Error) => void) {
  try {
    const token = socket.handshake.auth.token as string ||
    socket.handshake.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return next(new Error('Access token missing'))
    }

    const isBlacklisted = await sharedRepository.isTokenBlacklisted(token)

    if (isBlacklisted) {
      return next(new Error('Token is blacklisted'))
    }

    const decoded = verifyToken(token, 'access')

    if (!decoded || decoded.type !== 'access' || !decoded.userId) {
      return next(new Error('Invalid token'))
    }

    const user = await sharedRepository.findById(decoded.userId)

    if (!user) {
      return next(new Error('User not found'))
    }

    if (user.deleted_at !== null) {
      return next(new Error('Account is deactivated'))
    }

    socket.user = user
    next()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Authentication socket failed'
    next(new Error(message))
  }
}

export async function optionalSocketAuthMiddleware(socket: AuthSocket, next: (err?: Error) => void) {
  try {
    const token = socket.handshake.auth.token as string ||
    socket.handshake.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return next()
    }

    const isBlacklisted = await sharedRepository.isTokenBlacklisted(token)

    if (isBlacklisted) {
      return next()
    }

    const decoded = verifyToken(token, 'access')

    if (!decoded || decoded.type !== 'access' || !decoded.userId) {
      return next()
    }

    const user = await sharedRepository.findById(decoded.userId)

    if (user && user.deleted_at === null) {
      socket.user = user
    }

    next()
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Authentication socket failed'
    next(new Error(message))
  }
}
