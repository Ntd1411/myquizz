import { create } from 'zustand'
import type { User } from '@/services/auth.service'
import { authService } from '@/services/auth.service'
import { userService } from '@/services/user.service'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  
  // Actions
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  setUser: (user) => set({ 
    user, 
    isAuthenticated: !!user,
    error: null 
  }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  clearError: () => set({ error: null }),

  logout: async () => {
    try {
      set({ isLoading: true, error: null })
      await authService.logout()
      set({ 
        user: null, 
        isAuthenticated: false,
        isLoading: false 
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Đăng xuất thất bại'
      set({ error: message, isLoading: false })
    }
  },

  checkAuth: async () => {
    try {
      set({ isLoading: true, error: null })
      const user = await userService.getCurrentUser()
      set({ 
        user, 
        isAuthenticated: true,
        isLoading: false 
      })
    } catch (error) {
      set({ 
        user: null, 
        isAuthenticated: false,
        isLoading: false,
        error: null
      })
    }
  }
}))
