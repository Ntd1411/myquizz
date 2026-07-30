export const STATE_COOKIE = 'g_oauth_state'
export const STATE_TTL_MS = 10 * 60 * 1000
export const GOOGLE_SCOPES = ['openid', 'email', 'profile']
import { type Request } from 'express'

export interface GoogleProfile {
  googleId: string
  email: string
  emailVerified: boolean
  fullname: string
  avatar?: string
}

export interface AuthRequest extends Request {
  user?: User | null
  token?: string
  validatedQuery?: unknown
  data?: unknown
}

export interface User {
  id: number
  fullname: string
  email: string
  phone?: string
  password: string | null
  role: 'admin' | 'moderator' | 'user'
  avatar?: string
  description?: string
  google_id?: string | null
  auth_provider: 'local' | 'google'
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface RefreshSession {
  id: number
  user_id: number
  device_name: string
  ip_address: string
  refresh_token: string
  expires_at: string
  created_at: string
}
