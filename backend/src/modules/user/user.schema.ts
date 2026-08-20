import { z } from 'zod'

export const USER_CACHE_TTL = 5 * 60 // 5 minutes
export const USER_CACHE_PREFIX = 'user:profile'
export const RESET_TTL = 2 * 60 // 2 minutes: lifetime of the OTP and of the emailed link
export const RESET_RESEND_TTL = 60 // 1 minute between two sends
export const RESET_TICKET_TTL = 10 * 60 // 10 minutes to type the new password
export const RESET_MAX_ATTEMPTS = 5 // Wrong codes tolerated before the OTP is burned
export const RESET_PREFIX = 'user:reset'

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(8, 'Password must be at least 8 characters'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
})

export const updateProfileSchema = z.strictObject({
  fullname: z.string().min(2, 'Full name must be at least 2 characters').max(100, 'Full name must be at most 100 characters').optional(),
  phone: z.union([z.string().regex(/^\+?[0-9]{7,15}$/, 'Phone must be 7-15 digits'), z.literal('')]).optional(),
  description: z.string().max(200, 'Description must be at most 200 characters').optional()
})

export const deactivateAccountSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters')
})

export const forgotPasswordSchema = z.object({
  email: z.email('Email must be valid')
})

/**
 * Proof step of the reset. Either half of the email is accepted: the six-digit
 * code, which needs the address it was sent to, or the token from the link,
 * which names that address by itself. Both branches are strict, so a body
 * carrying a token AND an otp is rejected instead of quietly taking one path.
 */
export const verifyResetSchema = z.union([
  z.strictObject({
    email: z.email('Email must be valid'),
    otp: z.string().length(6, 'OTP must be 6 digits')
  }),
  z.strictObject({
    token: z.string().min(1, 'Token is required')
  })
])

export const completeResetSchema = z.strictObject({
  ticket: z.string().min(1, 'Ticket is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
})

export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>
export type DeactivateAccountRequest = z.infer<typeof deactivateAccountSchema>
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>
export type VerifyResetRequest = z.infer<typeof verifyResetSchema>
export type CompleteResetRequest = z.infer<typeof completeResetSchema>

export type ResetSchedule = {
  resetTime: Date
  expiresAt: Date
}

// Answer of the proof step: the key to the reset page, when that key dies, and
// the masked address so the page can say where the code came from.
export type ResetTicket = {
  ticket: string
  expiresAt: Date
  email: string
}

// Answer of the lookup the reset page runs before it renders its form.
export type ResetTicketStatus = {
  email: string
  expiresAt: Date
}
