import axios from 'axios'

// The backend stores the JWT in HttpOnly cookies, so the browser must be allowed
// to send credentials on every single request. Without `withCredentials` the user
// is silently anonymous on every call.
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
})

// The only app-wide event left (see App.vue). A dead session is not something a
// single screen can answer; every other failure is reported where it happened, by
// the code that knows what the user was trying to do.
export const AUTH_EXPIRED_EVENT = 'myquizz:auth-expired'

// Single-flight refresh. A burst of parallel 401s must trigger only ONE
// /auth/refresh call; every other request waits for the same promise.
let refreshPromise = null

function refreshTokens() {
  if (!refreshPromise) {
    refreshPromise = http
      // The probe flag keeps this call itself out of the retry/expire pipeline.
      .post('/auth/refresh', null, { skipAuthHandling: true })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

// Requests that must never trigger a refresh-and-retry cycle.
// /auth/refresh returns only new tokens, and login/register/logout answer with a
// meaningful 401/403 of their own that the calling page has to surface as-is.
const NON_REFRESHABLE = ['/auth/refresh', '/auth/login', '/auth/register', '/auth/logout']

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const status = error.response?.status

    // 403, 404 and 429 are final: retrying changes nothing, so they travel straight
    // back to the caller. They used to raise an app-wide notice, which meant the same
    // failure was announced twice on any screen that also rendered its own state.
    if (status === 403 || status === 404 || status === 429) {
      return Promise.reject(error)
    }

    // Session probes (the bootstrap /users/me call) must stay completely silent:
    // for a guest a 401 is the correct answer, not an expired session.
    if (original?.skipAuthHandling) return Promise.reject(error)

    const isNonRefreshable = NON_REFRESHABLE.some((path) => original?.url?.includes(path))

    if (status === 401 && original && !original.__isRetry && !isNonRefreshable) {
      original.__isRetry = true
      try {
        await refreshTokens()
        return http(original)
      } catch (refreshError) {
        // The refresh token is gone or expired: the session is truly over.
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT))
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  },
)
