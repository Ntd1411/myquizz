import { Outlet, Link, useLocation } from 'react-router-dom'
import { cn } from '@/utils/cn'

export default function PublicLayout() {
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/welcome') return location.pathname === '/welcome'
    return location.pathname.startsWith(path)
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
          <Link to="/welcome" className="font-display text-xl font-bold text-primary hover:text-primary-hover transition-colors">
            MyQuizz
          </Link>
          <nav className="flex items-center gap-6" aria-label="Điều hướng chính">
            <Link
              to="/welcome"
              className={cn(
                'text-sm font-medium transition-colors',
                isActive('/welcome')
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
                isActive('/game/join')
                  ? 'text-ink'
                  : 'text-ink-muted hover:text-ink'
              )}
            >
              Chơi Game
            </Link>
            <Link
              to="/login"
              className={cn(
                'px-4 py-2 rounded-base font-medium',
                'bg-primary text-white',
                'hover:bg-primary-hover',
                'transition-all duration-base'
              )}
            >
              Đăng nhập
            </Link>
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
