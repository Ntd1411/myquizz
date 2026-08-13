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

  // Joining a live room is public: guests play with a nickname, signed-in users with
  // their account. A shared link can prefill the code with /join?code=ABC123.
  { path: '/join', name: 'join-game', component: () => import('@/pages/JoinGamePage.vue') },

  // Public creator profile. Lists only published quizzes with questions, so it is
  // readable by guests and is not a replacement for the owner's own library.
  {
    path: '/users/:id',
    name: 'user-profile',
    component: () => import('@/pages/UserProfilePage.vue'),
    props: true,
  },

  {
    path: '/library',
    name: 'library',
    component: () => import('@/pages/LibraryPage.vue'),
    meta: { requiresAuth: true },
  },

  // Account settings, backed by the user module: profile fields, avatar, password,
  // and account deactivation.
  {
    path: '/settings/profile',
    name: 'profile',
    component: () => import('@/pages/ProfilePage.vue'),
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
  /**
   * Lenis owns the scroll position: it keeps driving the window from its own RAF
   * loop, so the offset the router returns here is overwritten on the next frame and
   * the new page opens exactly where the previous one was left. Scrolling through
   * Lenis with `immediate` jumps without easing and keeps its internal position in
   * sync, then `false` tells the router not to scroll again on its own.
   */
  scrollBehavior(to, from, savedPosition) {
    const top = savedPosition ? savedPosition.top : 0
    const lenis = window.__lenis

    if (lenis) {
      lenis.scrollTo(top, { immediate: true, force: true })
      return false
    }

    // Reduced motion: Lenis is never started, so native scrolling applies.
    return { top }
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
