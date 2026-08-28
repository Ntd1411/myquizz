import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { ScrollTrigger } from '@/composables/useMotion'

const routes = [
  { path: '/', name: 'home', component: () => import('@/pages/HomePage.vue') },
  { path: '/discover', name: 'discover', component: () => import('@/pages/DiscoverPage.vue') },
  {
    path: '/quizzes/:id',
    name: 'quiz-detail',
    component: () => import('@/pages/QuizDetailPage.vue'),
    props: true,
  },

  // Preview: the quiz played alone in this tab, with no room, no socket and nothing
  // written down. Public on purpose, because the API already decides who may read the
  // quiz - a public one answers with its answer key, a private one answers 404 to
  // everyone but its owner - so a guard here would only refuse readers the API allows.
  // `bare` for the same reason the live-room screens are bare: a question is on the
  // clock, and a stray click into Discover is never what the reader meant.
  {
    path: '/quizzes/:id/preview',
    name: 'quiz-preview',
    component: () => import('@/pages/QuizPreviewPage.vue'),
    props: true,
    meta: { bare: true },
  },

  // Auth. `guestOnly` bounces an already logged-in user back to the home page.
  // Login and register are also `bare`: the split-screen shell owns the whole
  // viewport, so the site header and footer would only crowd it.
  { path: '/login', name: 'login', component: () => import('@/pages/LoginPage.vue'), meta: { guestOnly: true, bare: true } },
  { path: '/register', name: 'register', component: () => import('@/pages/RegisterPage.vue'), meta: { guestOnly: true, bare: true } },
  // The reset itself is three steps and two screens: /forgot-password asks for the
  // code and verifies it, /reset-password writes the password with the ticket that
  // verification handed out, and /reset-password/link is where the emailed link lands
  // with its token. None of them is `guestOnly`: a signed-in reader who cannot recall
  // the current password starts the same flow from account settings, and bouncing them
  // home would leave the reset half done.
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('@/pages/ForgotPasswordPage.vue'),
    meta: { bare: true },
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('@/pages/ResetPasswordPage.vue'),
    meta: { bare: true },
  },
  {
    path: '/reset-password/link',
    name: 'reset-password-link',
    component: () => import('@/pages/ResetPasswordPage.vue'),
    meta: { bare: true },
  },

  // Landing route the backend redirects to after Google OAuth sets the cookies.
  { path: '/auth/callback', name: 'auth-callback', component: () => import('@/pages/AuthCallbackPage.vue') },

  // Joining a live room is public: guests play with a nickname, signed-in users with
  // their account. A shared link can prefill the code with /join?code=ABC123.
  // `bare` drops the site header and footer: the live-room screens carry their own bar,
  // because one stray click into the rest of the app leaves the room.
  {
    path: '/join',
    name: 'join-game',
    component: () => import('@/pages/JoinGamePage.vue'),
    meta: { bare: true },
  },

  // Setting up a room is its own screen, not a dialog: the mode decides which settings
  // exist, so the form is too tall to sit on top of the quiz page.
  {
    path: '/host/new/:quizId',
    name: 'host-setup',
    component: () => import('@/pages/HostSetupPage.vue'),
    props: true,
    meta: { requiresAuth: true },
  },

  // Hosting is the opposite: the code in the URL is public, so the page still asks the
  // server for a host token and only shows the lobby if the session belongs to this user.
  {
    path: '/host/:code',
    name: 'host-lobby',
    component: () => import('@/pages/HostLobbyPage.vue'),
    props: true,
    meta: { requiresAuth: true, bare: true },
  },

  // Player lobby. Public like /join: the seat comes from the socket token handed out by
  // the join step (kept per tab), never from the code in the URL.
  {
    path: '/play/:code',
    name: 'play-lobby',
    component: () => import('@/pages/PlayerLobbyPage.vue'),
    props: true,
    meta: { bare: true },
  },

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

  // Play history, list and one match. Public on purpose: a guest's matches are tied to
  // the UUID their browser already carries, sent as a header, so `requiresAuth` would
  // lock out exactly the readers who need this screen most. Permission is decided by
  // the API for every row, never by the URL.
  {
    path: '/history',
    name: 'history',
    component: () => import('@/pages/HistoryPage.vue'),
  },
  {
    path: '/history/:sessionId',
    name: 'history-detail',
    component: () => import('@/pages/GameHistoryDetailPage.vue'),
    props: true,
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

  // Admin. `requiresAdmin` implies a session, but `requiresAuth` is stated as well so
  // a signed-out reader lands on the login screen with a redirect back here, rather
  // than being bounced home for a permission they might actually hold.
  {
    path: '/admin/users',
    name: 'admin-users',
    component: () => import('@/pages/AdminUsersPage.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },

  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  /**
   * A new page opens at the top; back and forward restore the offset they saved.
   *
   * ScrollTrigger remembers the scroll position of every scroller it manages and puts
   * it back whenever it refreshes. The reveals of the page being opened refresh as its
   * data arrives, which is what dragged a freshly opened page back down to the offset
   * of the page the reader just left. Clearing that memory on every navigation is what
   * GSAP exposes it for.
   */
  scrollBehavior(to, from, savedPosition) {
    ScrollTrigger.clearScrollMemory()
    return { top: savedPosition ? savedPosition.top : 0 }
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

  // The guard only keeps the screen from being built for the wrong reader; the API is
  // what actually refuses the data, with a 403 on every /admin call.
  if (to.meta.requiresAdmin && !auth.isAdmin) {
    return { name: 'home' }
  }

  if (to.meta.guestOnly && auth.isLoggedIn) {
    return { name: 'home' }
  }

  return true
})

/*
 * Safety net for the scroll reveals. Each page kills the triggers it creates, but a
 * trigger that slips through lives forever: App never unmounts, so nothing collects it,
 * and every ScrollTrigger.refresh() anywhere in the app then has to walk it again. That
 * is how a page ends up feeling heavy for reasons that live on a page the reader already
 * left. A trigger whose element is no longer in the document can never fire again, so
 * dropping it is always safe. The sweep waits a tick: the outgoing page is torn down
 * after this hook runs, and its nodes are only detached by then.
 */
router.afterEach(() => {
  setTimeout(() => {
    ScrollTrigger.getAll().forEach((trigger) => {
      const el = trigger.trigger
      if (el instanceof Element && !el.isConnected) trigger.kill()
    })
  }, 0)
})

export default router
