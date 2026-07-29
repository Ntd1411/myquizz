import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../types/shared.types.js'
import { AppError } from '../errors/AppError.js'
import RedisClient from '../../infrastructure/cache/redis.client.js'

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
      const ip = req.ip || req.socket.remoteAddress || 'unknown'

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
      res.setHeader('X-RateLimit-Remaining', (maxRequests - current).toString())
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
      next(error)
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 1000,
  keyPrefix: 'rate_limit:api',
  byBoth: true // userId + IP
})

export const authRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 5,
  keyPrefix: 'rate_limit:auth',
  byIp: true,
  skipSuccessfulRequests: true // Only count failed requests
})
