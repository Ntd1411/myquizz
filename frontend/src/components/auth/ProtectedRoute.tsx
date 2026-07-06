import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { useEffect, useState } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation()
  const checkAuth = useAuthStore(state => state.checkAuth)
  const [isChecking, setIsChecking] = useState(true)
  const [shouldRedirect, setShouldRedirect] = useState(false)

  useEffect(() => {
    const verify = async () => {
      await checkAuth()
      const isAuth = useAuthStore.getState().isAuthenticated
      setShouldRedirect(!isAuth)
      setIsChecking(false)
    }
    verify()
  }, [checkAuth])

  if (isChecking) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-ink-muted">Đang xác thực...</p>
        </div>
      </div>
    )
  }

  if (shouldRedirect) {
    return <Navigate to="/welcome" state={{ from: location }} replace />
  }

  return <>{children}</>
}
