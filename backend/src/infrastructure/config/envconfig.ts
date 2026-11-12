import 'dotenv/config'
import { z } from 'zod'
import ms from 'ms'

const port = z.coerce.number().int().min(1).max(65535)
const duration = z.string().refine((value) => {
  const parsed = ms(value as ms.StringValue)
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0
}, 'Invalid duration')
const optionalUrl = z.preprocess(
  value => value === '' ? undefined : value,
  z.url().optional()
)

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test']),
  PORT: port,
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: duration,
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_REFRESH_EXPIRES_IN: duration,
  SOCKET_JWT_SECRET: z.string().min(1),
  SOCKET_TOKEN_TTL: duration,
  ALLOW_ORIGIN: z.string(),
  FRONTEND_URL: z.url(),
  // Public origin of this API, e.g. https://api.example.com (no trailing slash).
  // Optional so local development keeps working without it.
  API_PUBLIC_URL: optionalUrl,
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_HOST: z.string(),
  DB_PORT: port,
  DB_NAME: z.string(),
  DB_POOL_MAX: z.string().transform(Number),
  DB_IDLE_TIMEOUT: z.string().transform(Number),
  DB_CONNECTION_TIMEOUT: z.string().transform(Number),
  // Minutes between two runs of the quiz scoring job. Optional so existing .env
  // files keep working; set to 0 to disable the scheduler entirely.
  SCORING_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(30),
  REDIS_HOST: z.string(),
  REDIS_PORT: port,
  REDIS_PASSWORD: z.string(),
  SPACES_ACCESS_KEY: z.string(),
  SPACES_SECRET_KEY: z.string(),
  SPACES_BUCKET: z.string(),
  SPACES_REGION: z.string(),
  SPACES_ENDPOINT: z.string(),
  SPACES_PUBLIC_URL: z.string(),
  SMTP_HOST: z.string(),
  SMTP_PORT: port,
  SMTP_USER: z.string(),
  SMTP_PASSWORD: z.string(),
  MAIL_FROM: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CALLBACK_URL: z.string().url()
})

const envParsed = envSchema.safeParse(process.env)

if (!envParsed.success) {
  console.error('Invalid environment variables:', envParsed.error.issues.map((issue) => ({
    path: issue.path.join('.'), code: issue.code
  })))
  process.exit(1)
}

export const env = envParsed.data
