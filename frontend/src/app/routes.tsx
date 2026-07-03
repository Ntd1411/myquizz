import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import RootLayout from '@/layouts/RootLayout'
import AppLayout from '@/layouts/AppLayout'
import Landing from '@/pages/Landing.page'
import NotFound from '@/pages/NotFound.page'
import { AuthPageSkeleton } from '@/components/ui/AuthPageSkeleton'

// Lazy load pages that are not immediately visible
const DesignSystemPage = lazy(() => import('@/pages/DesignSystem.page').then(m => ({ default: m.DesignSystemPage })))
const ComponentsPage = lazy(() => import('@/pages/Components.page').then(m => ({ default: m.ComponentsPage })))
const Login = lazy(() => import('@/pages/auth/Login.page'))
const Register = lazy(() => import('@/pages/auth/Register.page'))
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword.page'))
const AppPage = lazy(() => import('@/pages/App.page'))

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen bg-bg flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      <p className="text-sm text-ink-muted">Đang tải...</p>
    </div>
  </div>
)

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <Landing />,
          },
          {
            path: 'browse',
            element: <div className="p-8">Browse page placeholder</div>,
          },
          {
            path: 'design-system',
            element: (
              <Suspense fallback={<PageLoader />}>
                <DesignSystemPage />
              </Suspense>
            ),
          },
          {
            path: 'components',
            element: (
              <Suspense fallback={<PageLoader />}>
                <ComponentsPage />
              </Suspense>
            ),
          },
          {
            path: 'app',
            element: (
              <Suspense fallback={<PageLoader />}>
                <AppPage />
              </Suspense>
            ),
          },
        ],
      },
      {
        path: 'login',
        element: (
          <Suspense fallback={<AuthPageSkeleton />}>
            <Login />
          </Suspense>
        ),
      },
      {
        path: 'register',
        element: (
          <Suspense fallback={<AuthPageSkeleton />}>
            <Register />
          </Suspense>
        ),
      },
      {
        path: 'forgot-password',
        element: (
          <Suspense fallback={<AuthPageSkeleton />}>
            <ForgotPassword />
          </Suspense>
        ),
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
])

export function AppRoutes() {
  return <RouterProvider router={router} />
}
