import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

const validEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  TRUST_PROXY_HOPS: '1',
  JWT_SECRET: 'test-secret',
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  JWT_REFRESH_EXPIRES_IN: '7d',
  SOCKET_JWT_SECRET: 'test-socket-secret',
  SOCKET_TOKEN_TTL: '6h',
  ALLOW_ORIGIN: 'http://localhost:5173',
  FRONTEND_URL: 'http://localhost:5173',
  API_PUBLIC_URL: '',
  DB_USER: 'postgres',
  DB_PASSWORD: 'postgres',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_NAME: 'myquizz_test',
  DB_POOL_MAX: '5',
  DB_IDLE_TIMEOUT: '30000',
  DB_CONNECTION_TIMEOUT: '5000',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  REDIS_PASSWORD: 'redis-password',
  SPACES_ACCESS_KEY: 'test-access-key',
  SPACES_SECRET_KEY: 'test-secret-key',
  SPACES_BUCKET: 'test-bucket',
  SPACES_REGION: 'test-region',
  SPACES_ENDPOINT: 'example.test',
  SPACES_PUBLIC_URL: 'https://example.test',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_USER: 'test-user',
  SMTP_PASSWORD: 'test-password',
  MAIL_FROM: 'no-reply@example.test',
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_CALLBACK_URL: 'http://localhost:3000/v1/auth/google/callback'
}

test('empty optional API public URL is treated as unset', () => {
  const result = spawnSync(process.execPath, [
    '--input-type=module',
    '--eval',
    "const { env } = await import('./dist/infrastructure/config/envconfig.js'); if (env.API_PUBLIC_URL !== undefined) process.exitCode = 2"
  ], {
    cwd: process.cwd(),
    env: validEnv,
    encoding: 'utf8'
  })

  assert.equal(result.status, 0, result.stderr)
})
