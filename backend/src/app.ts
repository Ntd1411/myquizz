import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { env } from './infrastructure/config/envconfig.js'
import { runMigrations } from './infrastructure/database/migrate.js'
import { authRouter } from './modules/auth/auth.route.js'
import { errorHandler } from './shared/middlewares/error.handler.js'
import cookieParser from 'cookie-parser'
import { userRouter } from './modules/user/user.route.js'
import { quizRouter } from './modules/quiz/quiz.route.js'
import gameRouter from './modules/game/game.route.js'
import { GameSocket } from './modules/game/game.socket.js'
import { docsRouter, internalDocsRouter } from './docs/serve.js'
import { socketDocsRouter } from './docs/serve.socket.js'
import RedisClient, { redisClient } from './infrastructure/cache/redis.client.js'
import { bootstrapEngine } from './modules/game/engine/index.js'
import { storageRouter } from './modules/storage/storage.route.js'
import { apiRateLimiter, globalRateLimiter } from './shared/middlewares/rate.limit.middleware.js'
import { pool, testConnection, closePool } from './infrastructure/database/connection.js'
import { startScoringScheduler, stopScoringScheduler } from './infrastructure/jobs/scoring.job.js'
import { adminRouter } from './modules/admin/admin.route.js'
import { authRepository } from './modules/auth/auth.repository.js'
import { AppError } from './shared/errors/AppError.js'
import { randomUUID } from 'node:crypto'

bootstrapEngine()

const port = env.PORT
await testConnection()
await runMigrations()

// Redis is a cache, not a hard dependency: log the failure and keep booting.
try {
  await redisClient.ping()
  console.log('Redis connected successfully')
} catch (error) {
  console.error('Redis connection failed, continuing without cache:', error)
}

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', env.TRUST_PROXY_HOPS)
const httpServer = createServer(app)
httpServer.requestTimeout = 30_000
httpServer.headersTimeout = 15_000
httpServer.keepAliveTimeout = 5_000
const io = new Server(httpServer, {
  cors: {
    origin: [env.FRONTEND_URL, ...env.ALLOW_ORIGIN.split(',').map((o) => o.trim())],
    credentials: true
  }
})

app.use((_req, res, next) => {
  const requestId = randomUUID()
  res.locals['requestId'] = requestId
  res.setHeader('X-Request-ID', requestId)
  next()
})

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = env.ALLOW_ORIGIN.split(',').map((o) => o.trim())
      allowedOrigins.push(env.FRONTEND_URL)

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new AppError(403, 'Origin is not allowed', 'FORBIDDEN'))
      }
    },
    credentials: true
  })
)

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  })
  next()
})

app.use(express.json({ limit: '100kb' }))

app.use(cookieParser())

app.use((req, _res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next()
  const cookies = req.cookies as Record<string, unknown> | undefined
  if (!cookies?.['accessToken'] && !cookies?.['refreshToken']) return next()
  const origin = req.get('Origin')
  if (!origin) return next() // native clients do not send Origin
  const allowed = [env.FRONTEND_URL, ...env.ALLOW_ORIGIN.split(',').map((value) => value.trim())]
  if (!allowed.includes(origin))
    return next(new AppError(403, 'Origin is not allowed', 'FORBIDDEN'))
  next()
})

// Health check stays above the rate limiter so monitoring keeps working even
// when Redis is down.
app.get('/health', async (req, res) => {
  const db = await pool.query('SELECT 1').then(() => true).catch(() => false)
  const redis = RedisClient.isConnected()
  res.status(db ? 200 : 503).json({ db, redis })
})
app.get('/health/live', (req, res) => res.status(200).json({ live: true }))
app.get('/health/ready', async (req, res) => {
  const db = await pool.query('SELECT 1').then(() => true).catch(() => false)
  const redis = RedisClient.isConnected()
  res.status(db && redis ? 200 : 503).json({ db, redis, realtime: true })
})

app.use(globalRateLimiter)

const router = express.Router()

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

router.get('/', (req, res) => res.send({ success: 'ok' }))

// The realtime layer cannot be expressed in OpenAPI, so the Socket.IO events
// are published as an AsyncAPI document on their own page. It is mounted first
// because docsRouter answers every path under /docs.
router.use('/docs/socket', socketDocsRouter)

// Public reference, read-only. The interactive one lives under /api-docs and is
// restricted to basic auth in the reverse proxy.
router.use('/docs', docsRouter)
router.use('/api-docs', internalDocsRouter)

router.use('/auth', authRouter)
router.use('/users', userRouter)
router.use('/quizzes', quizRouter)
router.use('/games', gameRouter)
router.use('/storage', storageRouter)
router.use('/admin', adminRouter)

const gameSocket = new GameSocket(io)
await gameSocket.recover()

app.use('/v1', apiRateLimiter, router)
app.use(errorHandler)

httpServer.listen(port, () => {
  console.log(`App listening on port ${port}`)
  console.log('Socket.IO server ready')

  // Started after the server is listening so a slow first scoring pass never
  // delays readiness. Failures are logged inside the job, not fatal.
  startScoringScheduler()
  const cleanup = () => void authRepository.cleanupExpiredTokens().catch((error) => {
    console.error('Token cleanup failed:', error)
  })
  cleanup()
  setInterval(cleanup, 60 * 60 * 1000).unref()
})

const shutdown = () => {
  stopScoringScheduler()
  void io.close()
    .then(() => Promise.all([closePool(), RedisClient.disconnect()]))
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Shutdown failed:', error)
      process.exit(1)
    })
}
process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
