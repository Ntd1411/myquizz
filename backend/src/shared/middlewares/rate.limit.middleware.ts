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
  fallbackOnRedisError?: boolean
}

const fallbackAttempts = new Map<string, { count: number; expiresAt: number }>()

/**
 * Rate limit middleware using Redis
 * Limit the number of requests per userId and/or IP within a time window
 *
 * Auth endpoints use a local fallback counter when Redis is unavailable.
 * Other routes remain available if the Redis counter cannot be reached.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    keyPrefix,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    byIp = false,
    byBoth = false,
    fallbackOnRedisError = false
  } = options

  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const redis = RedisClient.getInstance()
      const userId = req.user?.id
      const rawIp = req.ip || req.socket.remoteAddress || 'unknown'

      // Normalize the IP: IPv6 loopback becomes IPv4 and characters that
      // clash with the Redis key delimiter are replaced.
      let ip = rawIp
      if (ip === '::1' || ip === '::ffff:127.0.0.1') {
        ip = '127.0.0.1'
      }
      // Drop the ::ffff: prefix of an IPv4-mapped IPv6 address
      ip = ip.replace(/^::ffff:/, '')
      // Replace : with - so it cannot collide with the Redis key delimiter
      ip = ip.replace(/:/g, '-')

      // Work out the identifier this request is counted against
      let identifier: string
      if (byBoth && userId) {
        // Limit by userId and IP together
        identifier = `${userId}:${ip}`
      } else if (byIp) {
        // Limit by IP only
        identifier = ip
      } else {
        // Limit by userId (default)
        if (!userId) {
          throw new AppError(401, 'Unauthorized', 'AUTH_TOKEN_MISSING')
        }
        identifier = userId.toString()
      }

      // Create Redis key: prefix:identifier:timestamp_window
      const now = Date.now()
      const windowStart = Math.floor(now / windowMs) * windowMs
      const key = `${keyPrefix}:${identifier}:${windowStart}`

      // Get the current number of requests
      const current = Number(await redis.eval(
        `local n = redis.call('INCR', KEYS[1])
         if n == 1 or redis.call('PTTL', KEYS[1]) < 0 then
           redis.call('PEXPIRE', KEYS[1], ARGV[1])
         end
         return n`,
        1, key, windowMs
      ))

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
          `Too many requests. Please try again in ${retryAfter} seconds`,
          'RATE_LIMITED'
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
        res.once('finish', () => {
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

        })
      }

      next()
    } catch (error) {
      // Business decisions of this middleware (401 Unauthorized, 429 Too Many
      // Requests) must still reach the client.
      if (error instanceof AppError) {
        return next(error)
      }

      if (fallbackOnRedisError) {
        const now = Date.now()
        const key = `${keyPrefix}:${req.ip || req.socket.remoteAddress || 'unknown'}`
        const previous = fallbackAttempts.get(key)
        const entry = previous && previous.expiresAt > now
          ? previous
          : { count: 0, expiresAt: now + windowMs }
        entry.count++
        fallbackAttempts.set(key, entry)
        if (entry.count > maxRequests)
          return next(new AppError(429, 'Too many requests', 'RATE_LIMITED'))
      }
      next()
    }
  }
}

export const uploadRateLimiter = createRateLimiter({
  windowMs: 2 * 60 * 1000, // 2 minutes
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
  windowMs: 1 * 60 * 1000, // 1 minute
  maxRequests: 100,
  keyPrefix: 'rate_limit:api',
  byIp: true
})

export const authRateLimiter = createRateLimiter({
  windowMs: 2 * 60 * 1000, // 2 minutes
  maxRequests: 5,
  keyPrefix: 'rate_limit:auth',
  byIp: true,
  fallbackOnRedisError: true
})

export const resetPasswordRateLimiter = createRateLimiter({
  windowMs: 2 * 60 * 1000, // 2 minutes
  maxRequests: 5,
  keyPrefix: 'rate_limit:reset-password',
  byIp: true,
  fallbackOnRedisError: true
})

/**
 * Guards the proof step of the password reset: POST /users/password-reset/verify
 * and POST /users/password-reset/ticket.
 *
 * Unlike the limiters above this one charges every attempt, successful or not.
 * A code guesser only ever produces failures, so excusing them would leave the
 * six-digit code protected by nothing but its own attempt counter.
 */
export const resetVerifyRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 20,
  keyPrefix: 'rate_limit:reset-verify',
  byIp: true,
  fallbackOnRedisError: true
})
