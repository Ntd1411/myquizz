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

export type LoginRequest = z.infer<typeof loginSchema>
export type RegisterRequest = z.infer<typeof registerSchema>
