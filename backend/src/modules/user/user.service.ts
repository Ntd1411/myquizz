import { AppError } from '../../shared/errors/AppError.js'
import { userRepository } from './user.repository.js'
import { hashPassword, hashToken, verifyPassword } from '../auth/auth.util.js'
import { authRepository } from '../auth/auth.repository.js'
import RedisClient from '../../infrastructure/cache/redis.client.js'
import { deleteFileService } from '../storage/storage.service.js'
import { mailService } from '../../infrastructure/mail/mail.service.js'
import { env } from '../../infrastructure/config/envconfig.js'
import {
  generateOTP,
  generateResetTicket,
  generateResetToken,
  maskEmail
} from './user.util.js'
import {
  RESET_MAX_ATTEMPTS,
  RESET_PREFIX,
  RESET_RESEND_TTL,
  RESET_TICKET_TTL,
  RESET_TTL,
  USER_CACHE_PREFIX,
  USER_CACHE_TTL,
  type ResetSchedule,
  type ResetTicket,
  type ResetTicketStatus,
  type VerifyResetRequest
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

/**
 * A reset lives in Redis under one namespace per kind of value, so no lookup can
 * ever hand back the wrong kind:
 *
 * - user:reset:otp:<email>       hash { otp, token, attempts }, RESET_TTL
 * - user:reset:link:<tokenHash>  the address behind an emailed link, RESET_TTL
 * - user:reset:resend:<email>    cooldown marker, RESET_RESEND_TTL
 * - user:reset:ticket:<hash>     the address allowed to set a password, RESET_TICKET_TTL
 *
 * Only digests of the code, the link token and the ticket are stored: a dump of
 * Redis is then a list of hashes, not a list of working credentials.
 */
function otpKeyOf(email: string): string {
  return `${RESET_PREFIX}:otp:${email}`
}

/**
 * Burns the proof of one reset: the code, the link that carried it, and the
 * cooldown. A ticket already handed out is deliberately left alone, that one
 * dies on its own TTL or when the password is written.
 */
async function clearResetState(email: string): Promise<void> {
  const redis = RedisClient.getInstance()
  const otpKey = otpKeyOf(email)
  const tokenHash = await redis.hget(otpKey, 'token')

  const keys = [otpKey, `${RESET_PREFIX}:resend:${email}`]

  if (tokenHash) keys.push(`${RESET_PREFIX}:link:${tokenHash}`)

  await redis.del(...keys)
}

/**
 * The account behind an address, refused for the same three reasons at every
 * step: no row, a deactivated row, or an account that signs in with Google and
 * has no password to reset. Checked again at the last step, because minutes pass
 * between asking for a code and typing the new password.
 */
async function findResettableUser(
  email: string,
  notFoundMessage = 'User not found'
): Promise<User> {
  const user = await userRepository.findByEmail(email)

  if (!user) {
    throw new AppError(404, notFoundMessage)
  }

  if (user.deleted_at) {
    throw new AppError(410, 'Account is deactivated')
  }

  if (user.auth_provider === 'google') {
    throw new AppError(400, 'Google account cannot reset password')
  }

  return user
}

/**
 * Step one: send the proof. Neither the code nor the link can set a password by
 * itself, both are only accepted by verifyResetService.
 */
export async function forgotPasswordService(email: string): Promise<ResetSchedule> {
  await findResettableUser(email, 'Email not found')

  const redis = RedisClient.getInstance()
  const otpKey = otpKeyOf(email)
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
  const previousTokenHash = await redis.hget(otpKey, 'token')
  if (previousTokenHash) {
    await redis.del(`${RESET_PREFIX}:link:${previousTokenHash}`)
  }

  const otp = generateOTP()
  const resetToken = generateResetToken()
  const tokenHash = hashToken(resetToken)
  // Written into the email, so it can never drift away from the actual TTL.
  const lifetime = `${RESET_TTL / 60} minutes`

  // The record is replaced rather than merged into, so a re-send cannot inherit
  // the attempt count of the code it replaces.
  await redis.del(otpKey)
  await redis.hset(otpKey, { otp: hashToken(otp), token: tokenHash, attempts: 0 })
  await redis.expire(otpKey, RESET_TTL)
  await redis.setex(`${RESET_PREFIX}:link:${tokenHash}`, RESET_TTL, email)
  await redis.setex(resendKey, RESET_RESEND_TTL, '1')

  const resetUrl = `${env.FRONTEND_URL}/reset-password/link?token=${resetToken}`

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

/**
 * Checks the six-digit code. Wrong guesses are charged to the code itself and not
 * only to the IP that sent them: six digits fall to a spread-out botnet long
 * before any per-IP window notices, so the code is what has to give up.
 */
async function emailFromResetOtp(email: string, otp: string): Promise<string> {
  const redis = RedisClient.getInstance()
  const otpKey = otpKeyOf(email)

  const savedOtp = await redis.hget(otpKey, 'otp')

  if (!savedOtp) {
    throw new AppError(400, 'OTP expired or not found')
  }

  if (savedOtp !== hashToken(otp)) {
    const attempts = await redis.hincrby(otpKey, 'attempts', 1)

    if (attempts >= RESET_MAX_ATTEMPTS) {
      await clearResetState(email)
      throw new AppError(429, 'Too many invalid codes. Please request a new one')
    }

    throw new AppError(400, 'Invalid OTP')
  }

  return email
}

// The emailed link names its own address, so nothing has to be typed with it.
async function emailFromResetToken(token: string): Promise<string> {
  const redis = RedisClient.getInstance()

  const email = await redis.get(`${RESET_PREFIX}:link:${hashToken(token)}`)

  if (!email) {
    throw new AppError(400, 'Reset token expired or invalid')
  }

  return email
}

/**
 * Step two: proof, and nothing else. Whichever half of the email the user still
 * has is exchanged for a ticket, and the password form is only reachable with
 * that ticket. Splitting the proof from the write is the whole point: the code
 * can die the moment it is used while the user still gets ten minutes to think
 * of a password, and a reset page can no longer be opened by replaying a URL.
 */
export async function verifyResetService(
  input: VerifyResetRequest
): Promise<ResetTicket> {
  const email =
    'token' in input
      ? await emailFromResetToken(input.token)
      : await emailFromResetOtp(input.email, input.otp)

  await findResettableUser(email)

  const redis = RedisClient.getInstance()
  const ticket = generateResetTicket()

  await redis.setex(
    `${RESET_PREFIX}:ticket:${hashToken(ticket)}`,
    RESET_TICKET_TTL,
    email
  )

  // The proof is spent here rather than at the write, so one email opens exactly
  // one reset page and the link stops working the moment the code is used.
  await clearResetState(email)

  return {
    ticket,
    expiresAt: new Date(Date.now() + RESET_TICKET_TTL * 1000),
    email: maskEmail(email)
  }
}

/**
 * Reads a ticket WITHOUT spending it, so the reset page can decide what to render
 * before it shows a form. An expired ticket then shows an explanation instead of
 * a form that fails after the password has been typed twice.
 */
export async function readResetTicketService(
  ticket: string
): Promise<ResetTicketStatus> {
  const redis = RedisClient.getInstance()
  const ticketKey = `${RESET_PREFIX}:ticket:${hashToken(ticket)}`

  const email = await redis.get(ticketKey)

  if (!email) {
    throw new AppError(400, 'Reset session expired or invalid')
  }

  const ttl = await redis.ttl(ticketKey)

  return {
    email: maskEmail(email),
    expiresAt: new Date(Date.now() + Math.max(ttl, 0) * 1000)
  }
}

/**
 * Step three, the only place that writes a password. It never sees the code or
 * the emailed token, only the ticket, and that ticket is single use.
 *
 * Every refresh token of the account is revoked: a reset is what somebody locked
 * out of their account does, and whoever locked them out must not keep a session.
 * Access tokens already issued stay valid until they expire, which is the same
 * window the rest of the app lives with.
 */
export async function completeResetService(
  ticket: string,
  newPassword: string
): Promise<void> {
  const redis = RedisClient.getInstance()
  const ticketKey = `${RESET_PREFIX}:ticket:${hashToken(ticket)}`

  const email = await redis.get(ticketKey)

  if (!email) {
    throw new AppError(400, 'Reset session expired or invalid')
  }

  const user = await findResettableUser(email)

  if (user.password && (await verifyPassword(newPassword, user.password))) {
    throw new AppError(
      400,
      'New password must be different from the old password'
    )
  }

  const newPasswordHash = await hashPassword(newPassword)
  const isPasswordChanged = await userRepository.changePassword(
    user.id,
    newPasswordHash
  )

  if (!isPasswordChanged) {
    throw new AppError(500, 'Failed to reset password')
  }

  await redis.del(ticketKey)
  await clearResetState(email)
  await authRepository.revokeUserSessions(user.id)
  await invalidateUserCache(user.id)

  // Sent, never awaited: the password is already written, and a mail outage must
  // not turn a finished reset into a 500 the user retries with a spent ticket.
  mailService.sendMail({
    to: email,
    subject: 'Your password was changed',
    html: `
  <h2>Password changed</h2>
  <p>The password of your MyQuizz account was just changed, and every device was signed out.</p>
  <p>If this was not you, reset the password again immediately.</p>
`,
    text: 'The password of your MyQuizz account was just changed, and every device was signed out. If this was not you, reset the password again immediately.'
  }).catch(error => {
    console.error('Failed to send password change email:', error)
  })
}
