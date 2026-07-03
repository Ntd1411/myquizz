import { z } from 'zod'
import apiClient from '@/lib/api-client'

// Schemas để validate input
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

// Types
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

// Type cho backend API (không có confirmPassword)
export type RegisterApiInput = Omit<RegisterInput, 'confirmPassword'>

export interface User {
  user_id: string
  email: string
  fullname: string
  phone?: string
  created_at: string
  updated_at: string
}

export interface AuthResponse {
  user: User
}

// Auth Service
export const authService = {
  async login(data: LoginInput): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login', data)
    return response.data
  },

  async register(data: RegisterApiInput): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/register', data)
    return response.data
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout')
  },

  async refreshToken(): Promise<void> {
    await apiClient.post('/auth/refresh')
  },

  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<{ user: User }>('/auth/me')
    return response.data.user
  },

  async forgotPassword(_data: ForgotPasswordInput): Promise<{ message: string }> {
    // Backend chưa có endpoint này, sẽ return mock response
    // TODO: Implement khi backend có API
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ message: 'Email khôi phục mật khẩu đã được gửi' })
      }, 1000)
    })
  }
}
