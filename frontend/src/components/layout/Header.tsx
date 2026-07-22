import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { User, LogOut, Settings, Plus } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAuthStore } from '@/stores/auth.store'

interface HeaderProps {
  variant?: 'default' | 'welcome'
}

export function Header({ variant = 'default' }: HeaderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuthStore()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const homeLink = variant === 'welcome' ? '/welcome' : '/'

  const isActive = (path: string) => {
    if (path === homeLink) return location.pathname === homeLink
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
    <header className="border-b border-border bg-surface sticky top-0 z-sticky">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link 
          to={homeLink} 
          className="font-display text-xl font-bold text-primary hover:text-primary-hover transition-colors"
        >
          MyQuizz
        </Link>
        
        <nav className="flex items-center gap-6" aria-label="Điều hướng chính">
          <Link
            to={homeLink}
            className={cn(
              'text-sm font-medium transition-colors',
              isActive(homeLink)
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
          <Link
            to="/game/join"
            className={cn(
              'text-sm font-medium transition-colors',
              isActive('/game')
                ? 'text-ink'
                : 'text-ink-muted hover:text-ink'
            )}
          >
            Tham gia
          </Link>

          {isAuthenticated && user ? (
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
                {getInitials(user.fullname)}
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-base shadow-lg py-1">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-medium text-ink">{user.fullname}</p>
                    <p className="text-xs text-ink-muted truncate">{user.email}</p>
                  </div>

                  <Link
                    to="/"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-ink hover:bg-surface-hover transition-colors"
                  >
                    <User className="w-4 h-4" />
                    <span>Dashboard</span>
                  </Link>

                  <Link
                    to="/quiz/create"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-ink hover:bg-surface-hover transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tạo quiz mới</span>
                  </Link>

                  <Link
                    to="/profile"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-ink hover:bg-surface-hover transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Cài đặt</span>
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-danger hover:bg-danger-subtle transition-colors border-t border-border mt-1"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/auth/login"
                className="text-sm font-medium text-ink-muted hover:text-ink transition-colors"
              >
                Đăng nhập
              </Link>
              <Link
                to="/auth/register"
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-base',
                  'bg-primary text-white',
                  'hover:bg-primary-hover transition-colors'
                )}
              >
                Đăng ký
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
