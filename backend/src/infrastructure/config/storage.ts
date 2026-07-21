import { env } from './envconfig.js'

export const storageConfig = {
  endpoint: env.SPACES_ENDPOINT,
  region: env.SPACES_REGION,
  bucket: env.SPACES_BUCKET,
  publicUrl: env.SPACES_PUBLIC_URL,
  credentials: {
    accessKeyId: env.SPACES_ACCESS_KEY,
    secretAccessKey: env.SPACES_SECRET_KEY
  }
}
