import { env } from './envconfig.js'

export const digitalOceanConfig = {
  endpoint: env.SPACES_ENDPOINT,
  region: env.SPACES_REGION,
  bucket: env.SPACES_BUCKET,
  credentials: {
    accessKeyId: env.SPACES_ACCESS_KEY,
    secretAccessKey: env.SPACES_SECRET_KEY
  }
}
