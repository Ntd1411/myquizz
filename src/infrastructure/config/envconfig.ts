import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().default('3000').transform(Number),
  JWT_SECRET: z.string().default('12345678'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().default('12345678'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  ALLOW_ORIGIN: z.string(),
  FRONTEND_URL: z.string().url(),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().default('5432').transform(Number),
  DB_NAME: z.string().default('myquizz'),
  DB_POOL_MAX: z.string().default('20').transform(Number),
  DB_IDLE_TIMEOUT: z.string().default('30000').transform(Number),
  DB_CONNECTION_TIMEOUT: z.string().default('5000').transform(Number),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform(Number),
  REDIS_PASSWORD: z.string().default('12345678'),
  SPACES_ACCESS_KEY: z.string().default('12345678'),
  SPACES_SECRET_KEY: z.string().default('12345678'),
  SPACES_BUCKET: z.string().default('my-bucket'),
  SPACES_REGION: z.string().default('sgp1'),
  SPACES_ENDPOINT: z.string().default('https://sgp1.digitaloceanspaces.com')
})

const envParsed = envSchema.safeParse(process.env)

if (!envParsed.success) {
  console.error('Invalid environment variables:', envParsed.error.format())
  process.exit(1)
}

export const env = envParsed.data
