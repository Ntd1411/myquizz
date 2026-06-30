import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { SignOut, GameController, Plus, House, User } from '@phosphor-icons/react'

export function Navigation() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isActive = (path: string) => location.pathname === path

  if (location.pathname === '/' || location.pathname === '/login' || location.pathname === '/register') {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <GameController size={32} weight="duotone" className="text-primary" />
              <span className="text-xl font-semibold tracking-tight">MyQuizz</span>
            </Link>
            <div className="flex items-center gap-4">
              {!isAuthenticated ? (
                <>
                  <Link to="/login" className="btn-ghost">
                    Sign In
                  </Link>
                  <Link to="/register" className="btn-primary">
                    Get Started
                  </Link>
                </>
              ) : (
                <Link to="/home" className="btn-primary">
                  Dashboard
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link to="/home" className="flex items-center gap-2">
            <GameController size={32} weight="duotone" className="text-primary" />
            <span className="text-xl font-semibold tracking-tight">MyQuizz</span>
          </Link>

          {isAuthenticated && (
            <div className="flex items-center gap-6">
              <Link
                to="/home"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isActive('/home')
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <House size={20} weight={isActive('/home') ? 'fill' : 'regular'} />
                <span className="font-medium">Home</span>
              </Link>

              <Link
                to="/dashboard"
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isActive('/dashboard')
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Plus size={20} weight={isActive('/dashboard') ? 'fill' : 'regular'} />
                <span className="font-medium">Create</span>
              </Link>

              <div className="flex items-center gap-3 pl-6 border-l border-zinc-200 dark:border-zinc-800">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.fullname} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User size={18} weight="duotone" className="text-primary" />
                    </div>
                  )}
                  <span className="font-medium text-sm">{user?.fullname}</span>
                </Link>

                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                  title="Sign Out"
                >
                  <SignOut size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
