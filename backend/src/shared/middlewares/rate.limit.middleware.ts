import type { Response, NextFunction } from 'express'
import { AppError } from '../errors/AppError.js'
import RedisClient from '../../infrastructure/cache/redis.client.js'
import type { AuthRequest } from '../../modules/auth/auth.type.js'

interface RateLimitOptions {
  windowMs: number // Window time in milliseconds
  maxRequests: number // Max requests per window
  keyPrefix: string // Prefix for Redis key
  skipSuccessfulRequests?: boolean // Only count failed requests
  skipFailedRequests?: boolean // Only count successful requests
  byIp?: boolean // Rate limit by IP address instead of userId
  byBoth?: boolean // Rate limit by both userId and IP
}

/**
 * Rate limit middleware using Redis
 * Limit the number of requests per userId and/or IP within a time window
 *
 * Fails open: when Redis is unreachable the request is allowed through instead
 * of returning 500. Losing rate limiting for a few minutes is cheaper than
 * taking the whole API down, since this middleware runs on every request.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    keyPrefix,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    byIp = false,
    byBoth = false
  } = options

  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const redis = RedisClient.getInstance()
      const userId = req.user?.id
      const rawIp = req.ip || req.socket.remoteAddress || 'unknown'

      // Normalize IP address: chuyển IPv6 loopback thành IPv4, loại bỏ ký tự đặc biệt
      let ip = rawIp
      if (ip === '::1' || ip === '::ffff:127.0.0.1') {
        ip = '127.0.0.1'
      }
      // Loại bỏ prefix ::ffff: của IPv4-mapped IPv6
      ip = ip.replace(/^::ffff:/, '')
      // Thay thế : bằng - để tránh conflict với Redis key delimiter
      ip = ip.replace(/:/g, '-')

      // Xác định identifier cho rate limit
      let identifier: string
      if (byBoth && userId) {
        // Rate limit theo cả userId và IP
        identifier = `${userId}:${ip}`
      } else if (byIp) {
        // Rate limit chỉ theo IP
        identifier = ip
      } else {
        // Rate limit theo userId (mặc định)
        if (!userId) {
          throw new AppError(401, 'Unauthorized')
        }
        identifier = userId.toString()
      }

      // Create Redis key: prefix:identifier:timestamp_window
      const now = Date.now()
      const windowStart = Math.floor(now / windowMs) * windowMs
      const key = `${keyPrefix}:${identifier}:${windowStart}`

      // Get the current number of requests
      const current = await redis.incr(key)

      // Set TTL for the key if it's the first request
      if (current === 1) {
        await redis.pexpire(key, windowMs)
      }

      // Check if the limit has been exceeded
      if (current > maxRequests) {
        const ttl = await redis.pttl(key)
        const retryAfter = Math.ceil(ttl / 1000)

        res.setHeader('X-RateLimit-Limit', maxRequests.toString())
        res.setHeader('X-RateLimit-Remaining', '0')
        res.setHeader('X-RateLimit-Reset', (windowStart + windowMs).toString())
        res.setHeader('Retry-After', retryAfter.toString())

        throw new AppError(
          429,
          `Too many requests. Please try again in ${retryAfter} seconds`
        )
      }

      // Set headers
      res.setHeader('X-RateLimit-Limit', maxRequests.toString())
      res.setHeader(
        'X-RateLimit-Remaining',
        Math.max(0, maxRequests - current).toString()
      )
      res.setHeader('X-RateLimit-Reset', (windowStart + windowMs).toString())

      // If need to rollback when request fails/succeeds
      if (skipSuccessfulRequests || skipFailedRequests) {
        const originalSend = res.json.bind(res)
        res.json = function (body) {
          const statusCode = res.statusCode
          const isSuccess = statusCode >= 200 && statusCode < 300

          // Rollback counter if needed
          if (
            (skipSuccessfulRequests && isSuccess) ||
            (skipFailedRequests && !isSuccess)
          ) {
            redis.decr(key).catch((err) => {
              console.error('Failed to rollback rate limit counter:', err)
            })
          }

          return originalSend(body)
        }
      }

      next()
    } catch (error) {
      // Business decisions of this middleware (401 Unauthorized, 429 Too Many
      // Requests) must still reach the client.
      if (error instanceof AppError) {
        return next(error)
      }

      // Anything else means Redis itself is unavailable. Let the request
      // through unlimited rather than failing every single call.
      console.error('Rate limiter unavailable, allowing request through:', error)
      next()
    }
  }
}

export const uploadRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 20,
  keyPrefix: 'rate_limit:upload',
  skipFailedRequests: true, // Only count successful requests
  byBoth: true // Rate limit by both userId and IP
})

export const globalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 500,
  keyPrefix: 'rate_limit:global',
  byIp: true
})

export const apiRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 2000,
  keyPrefix: 'rate_limit:api',
  byIp: true
})

export const authRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 5,
  keyPrefix: 'rate_limit:auth',
  byIp: true,
  skipSuccessfulRequests: true // Only count failed requests
})

export const resetPasswordRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 5,
  keyPrefix: 'rate_limit:reset-password',
  byIp: true,
  skipFailedRequests: true // Only count successful requests
})
