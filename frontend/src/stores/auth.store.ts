import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/services/auth.service'
import { authService } from '@/services/auth.service'

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

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
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
          const user = await authService.getCurrentUser()
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
            error: null // Không set error vì có thể chưa login
          })
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)
