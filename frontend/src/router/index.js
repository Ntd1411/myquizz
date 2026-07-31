import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const routes = [
  { path: '/', name: 'home', component: () => import('@/pages/HomePage.vue') },
  { path: '/discover', name: 'discover', component: () => import('@/pages/DiscoverPage.vue') },
  {
    path: '/quizzes/:id',
    name: 'quiz-detail',
    component: () => import('@/pages/QuizDetailPage.vue'),
    props: true,
  },

  // Auth. `guestOnly` bounces an already logged-in user back to the home page.
  { path: '/login', name: 'login', component: () => import('@/pages/LoginPage.vue'), meta: { guestOnly: true } },
  { path: '/register', name: 'register', component: () => import('@/pages/RegisterPage.vue'), meta: { guestOnly: true } },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('@/pages/ForgotPasswordPage.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('@/pages/ResetPasswordPage.vue'),
    meta: { guestOnly: true },
  },

  // Landing route the backend redirects to after Google OAuth sets the cookies.
  { path: '/auth/callback', name: 'auth-callback', component: () => import('@/pages/AuthCallbackPage.vue') },

  {
    path: '/library',
    name: 'library',
    component: () => import('@/pages/LibraryPage.vue'),
    meta: { requiresAuth: true },
  },

  // Creation is a two-step flow: pick a method, then land in the editor. Importers
  // convert and validate on the first step and hand the draft over to the editor.
  {
    path: '/create',
    name: 'create-start',
    component: () => import('@/pages/CreateStartPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/create/quiz',
    name: 'create-quiz',
    component: () => import('@/pages/CreateQuizPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/quizzes/:id/edit',
    name: 'edit-quiz',
    component: () => import('@/pages/EditQuizPage.vue'),
    meta: { requiresAuth: true },
  },

  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Resolve the session exactly once before the first guarded navigation, so a hard
  // refresh on a protected page does not flash the login screen.
  if (!auth.ready) await auth.bootstrap()

  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.guestOnly && auth.isLoggedIn) {
    return { name: 'home' }
  }

  return true
})

export default router
