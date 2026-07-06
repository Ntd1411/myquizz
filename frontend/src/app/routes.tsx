import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import RootLayout from '@/layouts/RootLayout'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import PublicLayout from '@/layouts/PublicLayout'
import Landing from '@/pages/Landing.page'
import NotFound from '@/pages/NotFound.page'
import { AuthPageSkeleton } from '@/components/ui/AuthPageSkeleton'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { PublicRoute } from '@/components/auth/PublicRoute'

// Lazy load pages that are not immediately visible
const DesignSystemPage = lazy(() => import('@/pages/DesignSystem.page').then(m => ({ default: m.DesignSystemPage })))
const ComponentsPage = lazy(() => import('@/pages/Components.page').then(m => ({ default: m.ComponentsPage })))
const Login = lazy(() => import('@/pages/auth/Login.page'))
const Register = lazy(() => import('@/pages/auth/Register.page'))
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword.page'))
const DashboardPage = lazy(() => import('@/pages/Dashboard.page'))
const ExplorePage = lazy(() => import('@/pages/Explore.page').then(m => ({ default: m.ExplorePage })))
const QuizDetailPage = lazy(() => import('@/pages/QuizDetail.page').then(m => ({ default: m.QuizDetailPage })))
const JoinRoomPage = lazy(() => import('@/pages/JoinRoom.page').then(m => ({ default: m.JoinRoomPage })))
const WaitingRoomPage = lazy(() => import('@/pages/WaitingRoom.page').then(m => ({ default: m.WaitingRoomPage })))
const QuizPlayPage = lazy(() => import('@/pages/QuizPlay.page').then(m => ({ default: m.QuizPlayPage })))
const ResultPage = lazy(() => import('@/pages/Result.page').then(m => ({ default: m.ResultPage })))
const QuizBuilderPage = lazy(() => import('@/pages/QuizBuilder.page').then(m => ({ default: m.QuizBuilderPage })))

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
    element: (
      <ErrorBoundary>
        <RootLayout />
      </ErrorBoundary>
    ),
    children: [
      // Protected routes - require authentication
      {
        element: (
          <ErrorBoundary>
            <ProtectedRoute>
              <AuthenticatedLayout />
            </ProtectedRoute>
          </ErrorBoundary>
        ),
        children: [
          {
            index: true,
            element: (
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <DashboardPage />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            path: 'quiz/create',
            element: (
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <QuizBuilderPage />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            path: 'quiz/edit/:quizId',
            element: (
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <QuizBuilderPage />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            path: 'my-quizzes',
            element: (
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <DashboardPage />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            path: 'profile',
            element: (
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <DashboardPage />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            path: 'settings',
            element: (
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <DashboardPage />
                </Suspense>
              </ErrorBoundary>
            ),
          },
        ],
      },
      // Public routes - accessible without authentication
      {
        element: (
          <ErrorBoundary>
            <PublicLayout />
          </ErrorBoundary>
        ),
        children: [
          {
            path: 'welcome',
            element: (
              <ErrorBoundary>
                <Landing />
              </ErrorBoundary>
            ),
          },
          {
            path: 'explore',
            element: (
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <ExplorePage />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            path: 'quiz/:quizId',
            element: (
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <QuizDetailPage />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            path: 'game/join',
            element: (
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <JoinRoomPage />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            path: 'game/waiting/:roomCode',
            element: (
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <WaitingRoomPage />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            path: 'game/play/:roomCode',
            element: (
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <QuizPlayPage />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            path: 'game/result/:roomCode',
            element: (
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <ResultPage />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            path: 'design-system',
            element: (
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <DesignSystemPage />
                </Suspense>
              </ErrorBoundary>
            ),
          },
          {
            path: 'components',
            element: (
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <ComponentsPage />
                </Suspense>
              </ErrorBoundary>
            ),
          },
        ],
      },
      // Auth routes - redirect to / if already logged in
      {
        path: 'login',
        element: (
          <ErrorBoundary>
            <PublicRoute>
              <Suspense fallback={<AuthPageSkeleton />}>
                <Login />
              </Suspense>
            </PublicRoute>
          </ErrorBoundary>
        ),
      },
      {
        path: 'register',
        element: (
          <ErrorBoundary>
            <PublicRoute>
              <Suspense fallback={<AuthPageSkeleton />}>
                <Register />
              </Suspense>
            </PublicRoute>
          </ErrorBoundary>
        ),
      },
      {
        path: 'forgot-password',
        element: (
          <ErrorBoundary>
            <PublicRoute>
              <Suspense fallback={<AuthPageSkeleton />}>
                <ForgotPassword />
              </Suspense>
            </PublicRoute>
          </ErrorBoundary>
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
