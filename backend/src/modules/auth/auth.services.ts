import { env } from '../../infrastructure/config/envconfig.js'
import { authRepository } from './auth.repository.js'
import ms from 'ms'
import {
  generateTokens,
  hashPassword,
  verifyPassword,
  verifyToken,
  hashToken
} from './auth.utils.js'
import { AppError } from '../../shared/errors/AppError.js'
import { GOOGLE_SCOPES, type GoogleProfile, type User } from './auth.type.js'
import { oauthClient } from '../../infrastructure/config/google.config.js'
import { userRepository } from '../user/user.repository.js'

export async function registerService(
  email: string,
  password: string,
  fullname: string,
  phone?: string | null
) {
  // Check if user email or phone already exists
  const existingUser = await authRepository.emailExists(email)
  const existingPhone = phone ? await authRepository.phoneExists(phone) : false

  if (existingUser) {
    throw new AppError(409, 'Email already registered')
  }

  if (existingPhone) {
    throw new AppError(409, 'Phone number already registered')
  }

  // Hash password
  const hashedPassword = await hashPassword(password)

  // Create user
  const user = await authRepository.addUser({
    email,
    password: hashedPassword,
    fullname,
    phone: phone || null
  })

  if (!user) {
    throw new AppError(500, 'Failed to create user')
  }

  const { password: _pw, deleted_at: _deletedAt, ...userData } = user

  return userData
}

export async function loginService(
  email: string,
  password: string,
  deviceName: string,
  ipAddress: string
) {
  // Find user by email
  const user = await userRepository.findByEmail(email)

  if (!user) {
    throw new AppError(401, 'Invalid email or password')
  }

  // Check if user is active
  if (user.deleted_at !== null) {
    throw new AppError(403, 'Account is deactivated')
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password)

  if (!isValid) {
    throw new AppError(401, 'Invalid email or password')
  }

  // Generate tokens
  const tokens = generateTokens(user.id)

  const hashedRefreshToken = hashToken(tokens.refreshToken)

  await authRepository.saveRefreshToken(
    user.id,
    deviceName,
    ipAddress,
    hashedRefreshToken,
    new Date(Date.now() + ms(env.JWT_REFRESH_EXPIRES_IN as ms.StringValue))
  )

  const { password: _pw, deleted_at: _deletedAt, ...userData } = user

  return { user: userData, ...tokens }
}

export async function refreshTokenService(refreshToken: string) {
  // Verify refresh token
  const decoded = verifyToken(refreshToken, 'refresh')

  if (!decoded || decoded.type !== 'refresh') {
    throw new AppError(401, 'Invalid refresh token')
  }

  const user = await userRepository.findById(decoded.userId)
  if (!user) {
    throw new AppError(401, 'User not found')
  }

  if (user.deleted_at !== null) {
    throw new AppError(403, 'Account is deactivated')
  }

  const hashedRefreshToken = hashToken(refreshToken)

  const refreshSession =
    await authRepository.findRefreshToken(hashedRefreshToken)

  if (!refreshSession) {
    await authRepository.revokeUserSessions(decoded.userId)
    throw new AppError(401, 'Invalid refresh token')
  }

  await authRepository.revokeRefreshToken(hashedRefreshToken)

  // Generate new tokens
  const tokens = generateTokens(decoded.userId)

  await authRepository.saveRefreshToken(
    decoded.userId,
    refreshSession.device_name,
    refreshSession.ip_address,
    hashToken(tokens.refreshToken),
    new Date(Date.now() + ms(env.JWT_REFRESH_EXPIRES_IN as ms.StringValue))
  )

  return tokens
}

export async function logoutService(
  userId: number,
  accessToken: string,
  refreshToken: string
) {
  const decodedRefreshToken = verifyToken(refreshToken, 'refresh')
  const decodedAccessToken = verifyToken(accessToken, 'access')

  if (
    !decodedAccessToken ||
    decodedAccessToken.type !== 'access' ||
    decodedAccessToken.userId !== userId
  ) {
    throw new AppError(401, 'Invalid access token')
  }
  const hashedRefreshToken = hashToken(refreshToken)

  const refreshSession =
    await authRepository.findRefreshToken(hashedRefreshToken)

  if (!refreshSession) {
    await authRepository.revokeUserSessions(userId)
    throw new AppError(401, 'Invalid refresh token')
  }

  if (
    !decodedRefreshToken ||
    decodedRefreshToken.type !== 'refresh' ||
    decodedRefreshToken.userId !== userId
  ) {
    await authRepository.revokeUserSessions(userId)
    throw new AppError(401, 'Invalid refresh token')
  }

  await authRepository.revokeRefreshToken(hashedRefreshToken)
  await authRepository.revokeAccessToken(accessToken)
}

// Build the Google consent screen URL, carrying our anti-CSRF state
export function getGoogleAuthUrl(state: string): string {
  return oauthClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'select_account',
    scope: GOOGLE_SCOPES,
    state
  })
}

// Exchange the authorization code and verify the returned id_token
async function fetchGoogleProfile(code: string): Promise<GoogleProfile> {
  const { tokens } = await oauthClient.getToken(code)

  if (!tokens.id_token) {
    throw new AppError(401, 'Google did not return an id_token')
  }

  const ticket = await oauthClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: env.GOOGLE_CLIENT_ID
  })

  const payload = ticket.getPayload()
  if (!payload?.sub || !payload.email) {
    throw new AppError(401, 'Cannot read profile from Google account')
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified ?? false,
    fullname: payload.name ?? payload.email.split('@')[0] as string,
    avatar: payload.picture
  }
}

// Resolve (or create) the app user for a Google authorization code.
export async function loginWithGoogle(code: string): Promise<User> {
  const profile = await fetchGoogleProfile(code)

  // Already linked before
  const byGoogleId = await authRepository.findByGoogleId(profile.googleId)
  if (byGoogleId) {
    return byGoogleId
  }

  // Auto-link to an existing account with the same email.
  // Require a verified email to prevent account takeover.
  const byEmail = await userRepository.findByEmail(profile.email)
  if (byEmail) {
    if (!profile.emailVerified) {
      throw new AppError(401, 'Google email is not verified, cannot link account')
    }
    if (byEmail.deleted_at !== null) {
      throw new AppError(403, 'Account is deactivated')
    }
    return authRepository.linkGoogleId(
      byEmail.id,
      profile.googleId,
      profile.avatar
    )
  }

  // Brand new user
  return authRepository.addGoogleUser({
    fullname: profile.fullname,
    email: profile.email,
    googleId: profile.googleId,
    avatar: profile.avatar
  })
}
