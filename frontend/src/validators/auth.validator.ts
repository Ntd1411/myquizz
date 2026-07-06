import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu')
})

export const registerSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự'),
  confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu'),
  fullname: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(100, 'Họ tên không được quá 100 ký tự'),
  phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'Số điện thoại phải có 7-15 chữ số').optional().or(z.literal(''))
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Mật khẩu không khớp',
  path: ['confirmPassword']
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email không hợp lệ')
})

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự'),
  newPassword: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
})

export const updateProfileSchema = z.object({
  fullname: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(100, 'Họ tên không được quá 100 ký tự').optional(),
  email: z.string().email('Email không hợp lệ').optional(),
  phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'Số điện thoại phải có 7-15 chữ số').optional(),
  description: z.string().max(200, 'Mô tả không được quá 200 ký tự').optional()
})

export const deactivateAccountSchema = z.object({
  password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type DeactivateAccountInput = z.infer<typeof deactivateAccountSchema>

export type RegisterApiInput = Omit<RegisterInput, 'confirmPassword'>
