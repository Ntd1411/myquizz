import apiClient from '@/lib/api-client'
import type { LoginInput, RegisterApiInput, ForgotPasswordInput } from '@/validators/auth.validator'

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
