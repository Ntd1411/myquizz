import { z } from 'zod'

export const USER_CACHE_TTL = 5 * 60 // 5 minutes
export const USER_CACHE_PREFIX = 'user:profile'
export const RESET_TTL = 5 * 60 // 5 minutes
export const RESET_PREFIX = 'user:reset'

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(8, 'Password must be at least 8 characters'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
})

export const updateProfileSchema = z.strictObject({
  fullname: z.string().min(2, 'Full name must be at least 2 characters').max(100, 'Full name must be at most 100 characters').optional(),
  // An empty string is how a profile takes its number back off: the column is nullable
  // and the field optional at sign-up, so clearing it has to be expressible here too.
  phone: z.union([z.string().regex(/^\+?[0-9]{7,15}$/, 'Phone must be 7-15 digits'), z.literal('')]).optional(),
  description: z.string().max(200, 'Description must be at most 200 characters').optional()
})

export const deactivateAccountSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters')
})

export const forgotPasswordSchema = z.object({
  email: z.email('Email must be valid')
})

export const resetPasswordSchema = z.object({
  email: z.email('Email must be valid'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
})

export const resetPasswordWithTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
})

export const verifyResetTokenSchema = z.object({
  token: z.string().min(1, 'Token is required')
})

export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>
export type DeactivateAccountRequest = z.infer<typeof deactivateAccountSchema>
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>
export type ResetPasswordWithTokenRequest = z.infer<typeof resetPasswordWithTokenSchema>
export type VerifyResetTokenRequest = z.infer<typeof verifyResetTokenSchema>
