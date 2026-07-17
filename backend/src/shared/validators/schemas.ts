import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email('Email must be valid'),
  password: z.string().min(1, 'Password is required')
})

export const registerSchema = z.object({
  email: z.email('Email must be valid'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullname: z.string().min(2, 'Full name must be at least 2 characters').max(100, 'Full name must be at most 100 characters'),
  phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'Phone must be 7-15 digits').optional()
})

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(8, 'Password must be at least 8 characters'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
})

export const updateProfileSchema = z.object({
  fullname: z.string().min(2, 'Full name must be at least 2 characters').max(100, 'Full name must be at most 100 characters').optional(),
  email: z.email('Email must be valid').optional(),
  phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'Phone must be 7-15 digits').optional(),
  description: z.string().max(200, 'Description must be at most 200 characters').optional()
})

export const deactivateAccountSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters')
})

export type LoginRequest = z.infer<typeof loginSchema>
export type RegisterRequest = z.infer<typeof registerSchema>
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>
export type DeactivateAccountRequest = z.infer<typeof deactivateAccountSchema>
