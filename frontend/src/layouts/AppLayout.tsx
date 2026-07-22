import { Outlet } from 'react-router-dom'
import { Header } from '@/components/layout/Header'

export default function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[1000] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-base focus:shadow-lg"
      >
        Chuyển đến nội dung chính
      </a>

      <Header variant="default" />

      <main id="main-content" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-surface py-8">
        <div className="container mx-auto px-4 text-center text-sm text-ink-muted">
          <p>2026 MyQuizz. Tất cả quyền được bảo lưu.</p>
        </div>
      </footer>
    </div>
  )
}

