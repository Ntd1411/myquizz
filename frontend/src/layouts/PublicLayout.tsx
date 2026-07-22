import { Outlet } from 'react-router-dom'
import { Header } from '@/components/layout/Header'

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[1000] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-base focus:shadow-lg"
      >
        Chuyển đến nội dung chính
      </a>

      <Header variant="welcome" />

      <main className="flex-1" id="main-content">
        <Outlet />
      </main>
    </div>
  )
}

