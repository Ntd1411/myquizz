import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { Navigation } from '@/components/Navigation'
import LandingPage from '@/pages/Landing'
import LoginPage from '@/pages/Login'
import RegisterPage from '@/pages/Register'
import HomePage from '@/pages/Home'
import DashboardPage from '@/pages/Dashboard'
import CreateQuizPage from '@/pages/CreateQuiz'
import GamePlayerPage from '@/pages/GamePlayer'
import GameHostPage from '@/pages/GameHost'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return !isAuthenticated ? <>{children}</> : <Navigate to="/home" replace />
}

export function App() {
  return (
    <BrowserRouter>
      <Navigation />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

        <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/dashboard/create" element={<ProtectedRoute><CreateQuizPage /></ProtectedRoute>} />

        <Route path="/game/:sessionId" element={<GamePlayerPage />} />
        <Route path="/game/host/:sessionId" element={<ProtectedRoute><GameHostPage /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
