import type { Request, Response, NextFunction } from 'express'
import { CacheService } from '../../infrastructure/cache/index.js'

interface CacheOptions {
  ttl?: number // Thời gian cache (giây)
  keyGenerator?: (req: Request) => string // Tạo cache key tùy chỉnh
  condition?: (req: Request) => boolean // Điều kiện để cache
}

/**
 * Middleware cache response cho GET requests
 */
export function cacheMiddleware(options: CacheOptions = {}) {
  const {
    ttl = 300, // Mặc định 5 phút
    keyGenerator = (req) => `cache:${req.method}:${req.originalUrl}`,
    condition = () => true
  } = options

  return async (req: Request, res: Response, next: NextFunction) => {
    // Chỉ cache GET requests
    if (req.method !== 'GET') {
      return next()
    }

    // Kiểm tra điều kiện cache
    if (!condition(req)) {
      return next()
    }

    const cacheKey = keyGenerator(req)

    try {
      // Kiểm tra cache
      const cachedData = await CacheService.get(cacheKey)

      if (cachedData) {
        console.log(`Cache hit: ${cacheKey}`)
        return res.json(cachedData)
      }

      console.log(`Cache miss: ${cacheKey}`)

      // Lưu response vào cache
      const originalJson = res.json.bind(res)
      res.json = function (data: unknown) {
        // Cache response data
        CacheService.set(cacheKey, data, ttl).catch((error) => {
          console.error('Error caching response:', error)
        })

        return originalJson(data)
      }

      next()
    } catch (error) {
      console.error('Cache middleware error:', error)
      next()
    }
  }
}

/**
 * Middleware để vô hiệu hóa cache sau khi mutation
 */
export function invalidateCacheMiddleware(patterns: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Chỉ chạy sau khi response thành công
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Fire and forget - không chờ kết quả
        void (async () => {
          try {
            for (const pattern of patterns) {
              await CacheService.deleteByPattern(pattern)
              console.log(`Invalidated cache: ${pattern}`)
            }
          } catch (error) {
            console.error('Error invalidating cache:', error)
          }
        })()
      }
    })

    next()
  }
}

/**
 * Middleware cache dựa trên user
 */
interface AuthenticatedRequest extends Request {
  user?: {
    id: string
  }
}

export function userCacheMiddleware(options: CacheOptions = {}) {
  const { ttl = 300 } = options

  return cacheMiddleware({
    ttl,
    keyGenerator: (req) => {
      const authReq = req as AuthenticatedRequest
      const userId = authReq.user?.id ?? 'anonymous'
      return `cache:user:${userId}:${req.originalUrl}`
    }
  })
}

/**
 * Ví dụ sử dụng trong routes
 */

// Route với cache đơn giản
// router.get('/quizzes', cacheMiddleware({ ttl: 600 }), getQuizzes)

// Route với cache theo user
// router.get('/profile', authenticate, userCacheMiddleware({ ttl: 300 }), getProfile)

// Route mutation với invalidation
// router.post('/quizzes', authenticate, invalidateCacheMiddleware(['cache:*quizzes*']), createQuiz)

// Route với điều kiện cache
// router.get('/search', cacheMiddleware({
//   ttl: 60,
//   condition: (req) => !!req.query.q // Chỉ cache khi có query
// }), search)
