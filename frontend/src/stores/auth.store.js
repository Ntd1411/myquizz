import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as authApi from '@/api/auth.api'
import * as usersApi from '@/api/users.api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  // `ready` flips to true after the first bootstrap attempt. Route guards must wait
  // for it, otherwise a hard refresh on a protected page bounces to /login.
  const ready = ref(false)
  const pending = ref(false)

  const isLoggedIn = computed(() => user.value !== null)
  const displayName = computed(() => {
    if (!user.value) return ''
    return user.value.fullname || user.value.username || user.value.email || 'User'
  })

  /**
   * Called once at app start. A 401 here is expected and simply means "guest";
   * the http interceptor already tried a silent refresh before we get here.
   */
  async function bootstrap() {
    if (ready.value) return
    try {
      user.value = await usersApi.getMe()
    } catch {
      user.value = null
    } finally {
      ready.value = true
    }
  }

  async function login(credentials) {
    pending.value = true
    try {
      user.value = await authApi.login(credentials)
      return user.value
    } finally {
      pending.value = false
    }
  }

  async function register(payload) {
    pending.value = true
    try {
      await authApi.register(payload)
      // The backend does not always sign the user in on register, so read the
      // session back explicitly instead of trusting the register response.
      await refresh()
      return user.value
    } finally {
      pending.value = false
    }
  }

  async function refresh() {
    try {
      user.value = await usersApi.getMe()
    } catch {
      user.value = null
    }
    return user.value
  }

  async function logout() {
    try {
      await authApi.logout()
    } finally {
      user.value = null
    }
  }

  /** Called by the AUTH_EXPIRED event when the refresh token itself is dead. */
  function clear() {
    user.value = null
  }

  return {
    user,
    ready,
    pending,
    isLoggedIn,
    displayName,
    bootstrap,
    login,
    register,
    refresh,
    logout,
    clear,
  }
})
