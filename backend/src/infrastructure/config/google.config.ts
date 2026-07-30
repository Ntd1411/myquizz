import { OAuth2Client } from 'google-auth-library'
import { env } from '../config/envconfig.js'

export const oauthClient = new OAuth2Client({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: env.GOOGLE_CALLBACK_URL
})
