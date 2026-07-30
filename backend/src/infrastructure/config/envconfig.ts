import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test']),
  PORT: z.string().transform(Number),
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_REFRESH_EXPIRES_IN: z.string(),
  SOCKET_JWT_SECRET: z.string(),
  SOCKET_TOKEN_TTL: z.string(),
  ALLOW_ORIGIN: z.string(),
  FRONTEND_URL: z.url(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_HOST: z.string(),
  DB_PORT: z.string().transform(Number),
  DB_NAME: z.string(),
  DB_POOL_MAX: z.string().transform(Number),
  DB_IDLE_TIMEOUT: z.string().transform(Number),
  DB_CONNECTION_TIMEOUT: z.string().transform(Number),
  REDIS_HOST: z.string(),
  REDIS_PORT: z.string().transform(Number),
  REDIS_PASSWORD: z.string(),
  SPACES_ACCESS_KEY: z.string(),
  SPACES_SECRET_KEY: z.string(),
  SPACES_BUCKET: z.string(),
  SPACES_REGION: z.string(),
  SPACES_ENDPOINT: z.string(),
  SPACES_PUBLIC_URL: z.string(),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.string().transform(Number),
  SMTP_USER: z.string(),
  SMTP_PASSWORD: z.string(),
  MAIL_FROM: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CALLBACK_URL: z.string().url()
})

const envParsed = envSchema.safeParse(process.env)

if (!envParsed.success) {
  console.error('Invalid environment variables:', envParsed.error.format())
  process.exit(1)
}

export const env = envParsed.data
