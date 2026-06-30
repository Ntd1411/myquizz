import { create } from 'zustand'
import type { User, GameSession, PlayerSession } from '@/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  logout: () => set({ user: null, isAuthenticated: false }),
}))

interface GameState {
  currentSession: GameSession | null
  playerSession: PlayerSession | null
  currentQuestionIndex: number
  setCurrentSession: (session: GameSession | null) => void
  setPlayerSession: (session: PlayerSession | null) => void
  setCurrentQuestionIndex: (index: number) => void
  resetGame: () => void
}

export const useGameStore = create<GameState>((set) => ({
  currentSession: null,
  playerSession: null,
  currentQuestionIndex: 0,
  setCurrentSession: (session) => set({ currentSession: session }),
  setPlayerSession: (session) => set({ playerSession: session }),
  setCurrentQuestionIndex: (index) => set({ currentQuestionIndex: index }),
  resetGame: () => set({
    currentSession: null,
    playerSession: null,
    currentQuestionIndex: 0,
  }),
}))
