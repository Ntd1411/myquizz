import { AppError } from '../../shared/errors/AppError.js'
import { userRepository } from './user.repository.js'
import { hashPassword, verifyPassword } from '../auth/auth.util.js'
import RedisClient from '../../infrastructure/cache/redis.client.js'
import { deleteFileService } from '../storage/storage.service.js'
import { mailService } from '../../infrastructure/mail/mail.service.js'
import { env } from '../../infrastructure/config/envconfig.js'
import { generateOTP, generateResetToken } from './user.util.js'
import {
  RESET_PREFIX,
  RESET_RESEND_TTL,
  RESET_TTL,
  USER_CACHE_PREFIX,
  USER_CACHE_TTL,
  type ResetSchedule
} from './user.schema.js'
import type { User } from '../auth/auth.type.js'

async function invalidateUserCache(userId: number): Promise<void> {
  const redis = RedisClient.getInstance()
  const cacheKey = `${USER_CACHE_PREFIX}:${userId}`

  await redis.del(cacheKey)
}

export async function getUserService(userId: number): Promise<User> {
  const redis = RedisClient.getInstance()
  const cacheKey = `${USER_CACHE_PREFIX}:${userId}`

  const cached = await redis.get(cacheKey)
  if (cached) {
    return JSON.parse(cached) as User
  }
  // Cache miss
  const user = await userRepository.findById(userId)
  if (!user) {
    throw new AppError(404, 'User not found')
  }

  if (user.deleted_at) {
    throw new AppError(410, 'Account is deactivated')
  }

  await redis.setex(cacheKey, USER_CACHE_TTL, JSON.stringify(user))

  return user
}

export async function changePasswordService(
  user: User,
  oldPassword: string,
  newPassword: string
): Promise<void> {
  if (!user.password) {
    throw new AppError(400, 'User does not have a password set')
  }

  if (oldPassword === newPassword) {
    throw new AppError(
      400,
      'New password must be different from the old password'
    )
  }

  const isValid = await verifyPassword(oldPassword, user.password)

  if (!isValid) {
    throw new AppError(400, 'Old password is incorrect')
  }

  const newPasswordHash = await hashPassword(newPassword)

  const isPasswordChanged = await userRepository.changePassword(
    user.id,
    newPasswordHash
  )

  if (!isPasswordChanged) {
    throw new AppError(500, 'Failed to change password')
  }

  await invalidateUserCache(user.id)
}

export async function uploadAvatarService(
  userId: number,
  avatarUrl: string
): Promise<string> {
  const user = await userRepository.findById(userId)
  if (!user) {
    throw new AppError(404, 'User not found')
  }
  if (user.avatar)
    await deleteFileService(user.avatar)

  const isAvatarUploaded = await userRepository.uploadAvatar(userId, avatarUrl)

  if (!isAvatarUploaded) {
    throw new AppError(500, 'Failed to upload avatar')
  }

  await invalidateUserCache(userId)

  return avatarUrl
}

export async function updateProfileService(
  userId: number,
  fullname?: string,
  phone?: string,
  description?: string
): Promise<User> {
  const updates: Record<string, string | null> = {}

  if (fullname !== undefined) updates.fullname = fullname

  if (phone !== undefined) {
    if (phone) {
      const user = await userRepository.findByPhone(phone)
      if (user) {
        throw new AppError(400, 'Phone number is already in use')
      }
    }
    updates.phone = phone || null
  }

  if (description !== undefined) updates.description = description || null

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'No fields to update')
  }

  const isProfileUpdated = await userRepository.updateProfile(userId, updates)

  if (!isProfileUpdated) {
    throw new AppError(500, 'Failed to update profile')
  }

  await invalidateUserCache(userId)

  return userRepository.findById(userId) as unknown as User
}

export async function deactivateAccountService(
  user: User,
  password: string
): Promise<void> {
  if (!user.password) {
    throw new AppError(400, 'Cannot deactivate your account')
  }

  const isPasswordCorrect = await verifyPassword(password, user.password)

  if (!isPasswordCorrect) {
    throw new AppError(403, 'Invalid credentials')
  }

  const isDeactivated = await userRepository.deactivate(user.id)

  if (!isDeactivated) {
    throw new AppError(500, 'Failed to deactivate account')
  }

  await invalidateUserCache(user.id)
}

async function clearResetState(email: string): Promise<void> {
  const redis = RedisClient.getInstance()
  const linkKey = `${RESET_PREFIX}:link:${email}`
  const token = await redis.get(linkKey)

  const keys = [
    `${RESET_PREFIX}:${email}`,
    `${RESET_PREFIX}:resend:${email}`,
    linkKey
  ]

  if (token) keys.push(`${RESET_PREFIX}:${token}`)

  for (const key of keys) {
    await redis.del(key)
  }
}

export async function forgotPasswordService(email: string): Promise<ResetSchedule> {
  const user = await userRepository.findByEmail(email)

  if (!user) {
    throw new AppError(404, 'Email not found')
  }

  if (user.deleted_at) {
    throw new AppError(410, 'Account is deactivated')
  }

  if (user.auth_provider === 'google')
    throw new AppError(400, 'Google account cannot reset password')

  const redis = RedisClient.getInstance()
  const otpKey = `${RESET_PREFIX}:${email}`
  const linkKey = `${RESET_PREFIX}:link:${email}`
  const resendKey = `${RESET_PREFIX}:resend:${email}`

  const resendTtl = await redis.ttl(resendKey)

  if (resendTtl > 0) {
    const otpTtl = await redis.ttl(otpKey)

    return {
      resetTime: new Date(Date.now() + resendTtl * 1000),
      expiresAt: new Date(Date.now() + Math.max(otpTtl, 0) * 1000)
    }
  }

  // The cooldown is over, so this call really does send a new code. The previous link
  // dies with it: otherwise every re-send would leave another working token behind.
  const previousToken = await redis.get(linkKey)
  if (previousToken) {
    await redis.del(`${RESET_PREFIX}:${previousToken}`)
  }

  const otp = generateOTP()
  const resetToken = generateResetToken()
  const tokenKey = `${RESET_PREFIX}:${resetToken}`
  // Written into the email, so it can never drift away from the actual TTL.
  const lifetime = `${RESET_TTL / 60} minutes`

  await redis.setex(otpKey, RESET_TTL, otp)
  await redis.setex(tokenKey, RESET_TTL, email)
  await redis.setex(linkKey, RESET_TTL, resetToken)
  await redis.setex(resendKey, RESET_RESEND_TTL, resetToken)

  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`

  const resetHtml = `
  <h2>Reset Password</h2>
  <p>Click the link below to reset your password:</p>
  <p>
    <a href="${resetUrl}"
       style="display:inline-block;padding:10px 20px;background:#007bff;color:#fff;text-decoration:none;border-radius:5px">
      Reset Password
    </a>
  </p>
  <p>Or use this OTP code: <strong>${otp}</strong></p>
  <p>Link and OTP will expire in ${lifetime}.</p>
  <p>If you didn't request this, please ignore this email.</p>
`

  mailService.sendMail({
    to: email,
    subject: 'Reset Password',
    html: resetHtml,
    text: `Reset Password: ${resetUrl}\nOTP Code: ${otp}\nLink and OTP will expire in ${lifetime}.`
  }).catch(error => {
    console.error('Failed to send reset password email:', error)
  })

  return {
    resetTime: new Date(Date.now() + RESET_RESEND_TTL * 1000),
    expiresAt: new Date(Date.now() + RESET_TTL * 1000)
  }
}

export async function resetPasswordService(
  email: string,
  otp: string,
  newPassword: string
): Promise<void> {
  const redis = RedisClient.getInstance()
  const otpKey = `${RESET_PREFIX}:${email}`

  const savedOtp = await redis.get(otpKey)

  if (!savedOtp) {
    throw new AppError(400, 'OTP expired or not found')
  }

  if (savedOtp !== otp) {
    throw new AppError(400, 'Invalid OTP')
  }

  const user = await userRepository.findByEmail(email)

  if (!user) {
    throw new AppError(404, 'User not found')
  }

  const newPasswordHash = await hashPassword(newPassword)
  const isPasswordChanged = await userRepository.changePassword(
    user.id,
    newPasswordHash
  )

  if (!isPasswordChanged) {
    throw new AppError(500, 'Failed to reset password')
  }

  await clearResetState(email)

  await invalidateUserCache(user.id)
}

/**
 * Checks a reset-link token WITHOUT consuming it. The page the emailed link opens
 * calls this first and only shows the password form while the token is still
 * alive; the actual reset re-checks the same key and deletes it.
 */
export async function verifyResetTokenService(token: string): Promise<{ email: string }> {
  const redis = RedisClient.getInstance()
  const tokenKey = `${RESET_PREFIX}:${token}`

  const email = await redis.get(tokenKey)

  if (!email) {
    throw new AppError(400, 'Reset token expired or invalid')
  }

  return { email }
}

export async function resetPasswordWithTokenService(
  token: string,
  newPassword: string
): Promise<void> {
  const redis = RedisClient.getInstance()
  const tokenKey = `${RESET_PREFIX}:${token}`

  const email = await redis.get(tokenKey)

  if (!email) {
    throw new AppError(400, 'Reset token expired or invalid')
  }

  const user = await userRepository.findByEmail(email)

  if (!user) {
    throw new AppError(404, 'User not found')
  }

  const newPasswordHash = await hashPassword(newPassword)
  const isPasswordChanged = await userRepository.changePassword(
    user.id,
    newPasswordHash
  )

  if (!isPasswordChanged) {
    throw new AppError(500, 'Failed to reset password')
  }

  await redis.del(tokenKey)
  await clearResetState(email)

  await invalidateUserCache(user.id)
}
