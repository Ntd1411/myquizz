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
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './swagger/swagger.config.js'
import { redisClient } from './infrastructure/cache/redis.client.js'
import { bootstrapEngine } from './modules/game/engine/index.js'
import { storageRouter } from './modules/storage/storage.route.js'
import { apiRateLimiter, globalRateLimiter } from './shared/middlewares/rate.limit.middleware.js'

bootstrapEngine()

const port = env.PORT
await runMigrations()

// Kiểm tra kết nối Redis
try {
  await redisClient.ping()
  console.log('Redis connected successfully')
} catch (error) {
  console.error('Redis connection failed:', error)
  process.exit(1)
}

const app = express()
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

app.use(globalRateLimiter)

app.get('/', (req, res) => {
  res.send('Hello, world')
})

const router = express.Router()
router.get('/', (req, res) => res.send({ success: 'ok' }))
router.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'MyQuizz API Documentation'
}))
router.use('/auth', authRouter)
router.use('/users', userRouter)
router.use('/quizzes', quizRouter)
router.use('/games', gameRouter)
router.use('/storage', storageRouter)

new GameSocket(io)

app.use('/api/v1', apiRateLimiter, router)
app.use(errorHandler)

httpServer.listen(port, () => {
  console.log(`App listening on port ${port}`)
  console.log('Socket.IO server ready')
})
