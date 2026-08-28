import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as authApi from '@/api/auth.api'
import * as usersApi from '@/api/users.api'

/**
 * Login state mirrors the backend exactly.
 *
 * The backend keeps accessToken / refreshToken in HttpOnly cookies, so the only
 * reliable way to know whether the user is signed in is to ask GET /users/me.
 * Nothing about the session is cached in localStorage: a stale flag there would
 * show a signed-in header while every API call answers 401.
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  // `ready` flips to true after the first session probe. Route guards and the header
  // must wait for it, otherwise a hard refresh flashes the guest state.
  const ready = ref(false)
  const pending = ref(false)

  const isLoggedIn = computed(() => user.value !== null)
  /**
   * Staff flag, read straight off the row GET /users/me returns. It decides what is
   * RENDERED - the Admin entries in the header, the /admin routes - and nothing else:
   * every /admin endpoint checks the role of the account behind the cookie again and
   * answers 403 on its own, so faking this in the console reveals no data.
   */
  const isAdmin = computed(() => user.value?.role === 'admin')
  // Fields come straight from the backend user row: fullname, email, avatar.
  const displayName = computed(() => user.value?.fullname || user.value?.email || 'Account')
  const avatarUrl = computed(() => user.value?.avatar || null)
  const initials = computed(() => (displayName.value.trim()[0] || 'A').toUpperCase())

  /**
   * Called once before the first navigation. A 401 here is the normal answer for a
   * guest, so the probe flag keeps it out of the refresh-and-retry pipeline and
   * prevents a bogus "session expired" toast on a plain first visit.
   */
  async function bootstrap() {
    if (ready.value) return user.value
    try {
      user.value = await usersApi.getMe({ probe: true })
    } catch {
      user.value = null
    } finally {
      ready.value = true
    }
    return user.value
  }

  async function login(credentials) {
    pending.value = true
    try {
      // POST /auth/login sets both cookies and returns the user in data.user.
      user.value = await authApi.login(credentials)
      ready.value = true
      return user.value
    } finally {
      pending.value = false
    }
  }

  async function register(payload) {
    pending.value = true
    try {
      // POST /auth/register only creates the row; it does not set any cookies.
      // Chain a normal login with the same credentials right after, so signing up
      // ends in exactly the same signed-in state as the login form does.
      await authApi.register(payload)
      user.value = await authApi.login({ email: payload.email, password: payload.password })
      ready.value = true
      return user.value
    } finally {
      pending.value = false
    }
  }

  /** Re-reads the session, e.g. after the Google OAuth redirect. */
  async function refresh() {
    try {
      user.value = await usersApi.getMe()
    } catch {
      user.value = null
    } finally {
      ready.value = true
    }
    return user.value
  }

  /**
   * Replaces the cached user with the row the backend just returned, e.g. after
   * PATCH /users/me. Keeps the header and every other consumer in sync without a
   * second round trip.
   */
  function setUser(next) {
    user.value = next ?? null
    ready.value = true
  }

  /**
   * Merges a few fields into the cached user. Used by endpoints that answer with a
   * single value instead of the whole row, such as PATCH /users/me/avatar.
   */
  function patchUser(partial) {
    if (!user.value) return
    user.value = { ...user.value, ...partial }
  }

  async function logout() {
    try {
      // POST /auth/logout requires a valid access token. If it is already gone the
      // backend answers 401, which still means the session is over locally.
      await authApi.logout()
    } catch {
      // Ignored on purpose: the local state must be cleared either way.
    } finally {
      user.value = null
      ready.value = true
    }
  }

  /** Called by the AUTH_EXPIRED event when the refresh token itself is dead. */
  function clear() {
    user.value = null
    ready.value = true
  }

  return {
    user,
    ready,
    pending,
    isLoggedIn,
    isAdmin,
    displayName,
    avatarUrl,
    initials,
    bootstrap,
    login,
    register,
    refresh,
    setUser,
    patchUser,
    logout,
    clear,
  }
})
