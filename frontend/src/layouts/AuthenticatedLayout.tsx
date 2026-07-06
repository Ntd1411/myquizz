import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { User, LogOut, Settings, FileText, Plus } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuthStore } from '@/stores/auth.store'

export default function AuthenticatedLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showUserMenu])

  const handleLogout = async () => {
    await logout()
    navigate('/welcome')
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[1000] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-base focus:shadow-lg"
      >
        Chuyển đến nội dung chính
      </a>

      <header className="border-b border-border bg-surface sticky top-0 z-sticky">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="font-display text-xl font-bold text-primary hover:text-primary-hover transition-colors">
            MyQuizz
          </Link>
          
          <nav className="flex items-center gap-6" aria-label="Điều hướng chính">
            <Link
              to="/"
              className={cn(
                'text-sm font-medium transition-colors',
                isActive('/') && !isActive('/explore') && !isActive('/quiz')
                  ? 'text-ink'
                  : 'text-ink-muted hover:text-ink'
              )}
            >
              Trang chủ
            </Link>
            <Link
              to="/explore"
              className={cn(
                'text-sm font-medium transition-colors',
                isActive('/explore')
                  ? 'text-ink'
                  : 'text-ink-muted hover:text-ink'
              )}
            >
              Khám phá
            </Link>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={cn(
                  'w-9 h-9 rounded-full bg-primary text-white',
                  'flex items-center justify-center',
                  'font-medium text-sm',
                  'hover:bg-primary-hover transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-primary/30'
                )}
                aria-label="Menu người dùng"
                aria-expanded={showUserMenu}
              >
                {getInitials(user?.fullname || 'User')}
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-surface border border-border rounded-lg shadow-xl py-2 z-dropdown">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-medium text-ink">{user?.fullname}</p>
                    <p className="text-xs text-ink-muted mt-1">{user?.email}</p>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/quiz/create"
                      onClick={() => setShowUserMenu(false)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2 text-sm text-ink',
                        'hover:bg-surface-hover transition-colors'
                      )}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tạo quiz mới</span>
                    </Link>

                    <Link
                      to="/my-quizzes"
                      onClick={() => setShowUserMenu(false)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2 text-sm text-ink',
                        'hover:bg-surface-hover transition-colors'
                      )}
                    >
                      <FileText className="w-4 h-4" />
                      <span>Quiz của tôi</span>
                    </Link>

                    <Link
                      to="/profile"
                      onClick={() => setShowUserMenu(false)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2 text-sm text-ink',
                        'hover:bg-surface-hover transition-colors'
                      )}
                    >
                      <User className="w-4 h-4" />
                      <span>Hồ sơ</span>
                    </Link>

                    <Link
                      to="/settings"
                      onClick={() => setShowUserMenu(false)}
                      className={cn(
                        'flex items-center gap-3 px-4 py-2 text-sm text-ink',
                        'hover:bg-surface-hover transition-colors'
                      )}
                    >
                      <Settings className="w-4 h-4" />
                      <span>Cài đặt</span>
                    </Link>
                  </div>

                  <div className="border-t border-border pt-1">
                    <button
                      onClick={handleLogout}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2 text-sm text-danger',
                        'hover:bg-danger-subtle transition-colors'
                      )}
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </nav>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-surface py-8">
        <div className="container mx-auto px-4 text-center text-ink-muted text-sm">
          © 2026 MyQuizz. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
