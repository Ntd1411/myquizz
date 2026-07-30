import { AppError } from '../../shared/errors/AppError.js'
import { userRepository } from './user.repository.js'
import { hashPassword, verifyPassword } from '../auth/auth.util.js'
import RedisClient from '../../infrastructure/cache/redis.client.js'
import { deleteFileService } from '../storage/storage.service.js'
import { mailService } from '../../infrastructure/mail/mail.service.js'
import { env } from '../../infrastructure/config/envconfig.js'
import { generateOTP, generateResetToken } from './user.util.js'
import { RESET_PREFIX, RESET_TTL, USER_CACHE_PREFIX, USER_CACHE_TTL } from './user.schema.js'
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
  email?: string,
  phone?: string,
  description?: string
): Promise<User> {
  const updates: Record<string, string> = {}

  if (fullname) updates.fullname = fullname
  if (email) {
    const user = await userRepository.findByEmail(email)
    if (user) {
      throw new AppError(400, 'Email is already in use')
    }
    updates.email = email
  }
  if (phone) {
    const user = await userRepository.findByPhone(phone)
    if (user) {
      throw new AppError(400, 'Phone number is already in use')
    }
    updates.phone = phone
  }
  if (description) updates.description = description

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

export async function forgotPasswordService(email: string): Promise<Date> {
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
  const existingOtp = await redis.get(otpKey)

  if (existingOtp) {
    const ttl = await redis.ttl(otpKey)
    throw new AppError(
      429,
      `OTP already sent. Please wait ${ttl} seconds before requesting again.`
    )
  }

  const otp = generateOTP()
  const resetToken = generateResetToken()
  const tokenKey = `${RESET_PREFIX}:${resetToken}`

  await redis.setex(otpKey, RESET_TTL, otp)
  await redis.setex(tokenKey, RESET_TTL, resetToken)

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
  <p>Link and OTP will expire in 5 minutes.</p>
  <p>If you didn't request this, please ignore this email.</p>
`

  mailService.sendMail({
    to: email,
    subject: 'Reset Password',
    html: resetHtml,
    text: `Reset Password: ${resetUrl}\nOTP Code: ${otp}\nLink and OTP will expire in 5 minutes.`
  }).catch(error => {
    console.error('Failed to send reset password email:', error)
  })

  const resetTime = new Date(Date.now() + RESET_TTL * 1000)
  return resetTime
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

  await redis.del(otpKey)

  const tokenPattern = `${RESET_PREFIX}:*`
  const keys = await redis.keys(tokenPattern)

  for (const key of keys) {
    const value = await redis.get(key)
    if (value === email) {
      await redis.del(key)
    }
  }

  await invalidateUserCache(user.id)
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

  const otpKey = `${RESET_PREFIX}:${email}`
  await redis.del(otpKey)

  await invalidateUserCache(user.id)
}
