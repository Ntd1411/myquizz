import 'dotenv/config';
import { jwt, z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
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
  REDIS_PASSWORD: z.string().default('12345678')
});

const envParsed = envSchema.safeParse(process.env);

if (!envParsed.success) {
  console.error('Invalid environment variables:', envParsed.error.format());
  process.exit(1);
}

const env = envParsed.data;

export const config = {
  database: {
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      max: env.DB_POOL_MAX,
      idleTimeoutMillis: env.DB_IDLE_TIMEOUT,
      connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT
  },
  server: {
    environment: env.NODE_ENV,
    port: env.PORT
  },
  jwt: {
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    jwtRefreshSecret: env.JWT_REFRESH_SECRET,
    jwtRefreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN
  },
  cors: {
    allowOrigin: env.ALLOW_ORIGIN,
    frontendUrl: env.FRONTEND_URL
  },
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD
  }
}