import { Outlet } from 'react-router-dom'

export default function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-surface">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="font-display text-xl font-bold text-primary">
            MyQuizz
          </div>
          <nav className="flex items-center gap-6">
            <a href="/" className="text-ink-muted hover:text-ink transition">
              Trang chủ
            </a>
            <a
              href="/browse"
              className="text-ink-muted hover:text-ink transition"
            >
              Khám phá
            </a>
            <a
              href="/login"
              className="text-ink-muted hover:text-ink transition"
            >
              Đăng nhập
            </a>
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
