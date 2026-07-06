import apiClient from '@/lib/api-client'

export interface User {
  user_id: string
  email: string
  fullname: string
  phone?: string
  created_at: string
  updated_at: string
}

export interface UpdateProfileData {
  fullname?: string
  email?: string
  phone?: string
  description?: string
}

export interface ChangePasswordData {
  oldPassword: string
  newPassword: string
}

// User Service
export const userService = {
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<User>('/users/me')
    return response.data
  },

  async updateProfile(data: UpdateProfileData): Promise<User> {
    const response = await apiClient.patch<{ user: User }>('/users/me', data)
    return response.data.user
  },

  async changePassword(data: ChangePasswordData): Promise<void> {
    await apiClient.patch('/users/me/password', data)
  },

  async deactivateAccount(password: string): Promise<void> {
    await apiClient.delete('/users/me', { data: { password } })
  }
}
