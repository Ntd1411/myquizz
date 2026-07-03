import { Outlet, Link, useLocation } from 'react-router-dom'
import { cn } from '@/utils/cn'

export default function AppLayout() {
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-surface sticky top-0 z-sticky">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="font-display text-xl font-bold text-primary hover:text-primary-hover transition-colors">
            MyQuizz
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              to="/"
              className={cn(
                'text-sm font-medium transition-colors',
                isActive('/') && !isActive('/explore')
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
              to="/login"
              className={cn(
                'text-sm font-medium transition-colors',
                isActive('/login')
                  ? 'text-ink'
                  : 'text-ink-muted hover:text-ink'
              )}
            >
              Đăng nhập
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
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
