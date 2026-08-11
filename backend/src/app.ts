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
import { docsRouter } from './docs/serve.js'
import RedisClient, { redisClient } from './infrastructure/cache/redis.client.js'
import { bootstrapEngine } from './modules/game/engine/index.js'
import { storageRouter } from './modules/storage/storage.route.js'
import { apiRateLimiter, globalRateLimiter } from './shared/middlewares/rate.limit.middleware.js'
import { pool } from './infrastructure/database/connection.js'
import { startScoringScheduler } from './infrastructure/jobs/scoring.job.js'

bootstrapEngine()

const port = env.PORT
await runMigrations()

// Redis is a cache, not a hard dependency: log the failure and keep booting.
try {
  await redisClient.ping()
  console.log('Redis connected successfully')
} catch (error) {
  console.error('Redis connection failed, continuing without cache:', error)
}

const app = express()
app.set('trust proxy', 1)
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: [env.FRONTEND_URL, ...env.ALLOW_ORIGIN.split(',').map((o) => o.trim())],
    credentials: true
  }
})

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = env.ALLOW_ORIGIN.split(',').map((o) => o.trim())
      allowedOrigins.push(env.FRONTEND_URL)

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true
  })
)

app.use(express.json())

app.use(cookieParser())

// Health check stays above the rate limiter so monitoring keeps working even
// when Redis is down.
app.get('/health', async (req, res) => {
  const db = await pool.query('SELECT 1').then(() => true).catch(() => false)
  const redis = RedisClient.isConnected()
  res.status(db ? 200 : 503).json({ db, redis })
})

app.use(globalRateLimiter)

app.get('/', (req, res) => {
  res.send('Hello, world')
})

const router = express.Router()
router.get('/', (req, res) => res.send({ success: 'ok' }))

router.use('/docs', docsRouter)

router.use('/auth', authRouter)
router.use('/users', userRouter)
router.use('/quizzes', quizRouter)
router.use('/games', gameRouter)
router.use('/storage', storageRouter)

new GameSocket(io)

app.use('/v1', apiRateLimiter, router)
app.use(errorHandler)

httpServer.listen(port, () => {
  console.log(`App listening on port ${port}`)
  console.log('Socket.IO server ready')

  // Started after the server is listening so a slow first scoring pass never
  // delays readiness. Failures are logged inside the job, not fatal.
  startScoringScheduler()
})
