import axios from 'axios'

// The backend stores the JWT in HttpOnly cookies, so the browser must be allowed
// to send credentials on every single request. Without `withCredentials` the user
// is silently anonymous on every call.
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
})

// Events the app layer listens to (see App.vue / auth store).
export const AUTH_EXPIRED_EVENT = 'myquizz:auth-expired'
export const RATE_LIMITED_EVENT = 'myquizz:rate-limited'
export const FORBIDDEN_EVENT = 'myquizz:forbidden'
export const NOT_FOUND_EVENT = 'myquizz:not-found'

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

    if (status === 429) {
      window.dispatchEvent(new CustomEvent(RATE_LIMITED_EVENT))
      return Promise.reject(error)
    }

    // 403 and 404 are final: retrying changes nothing, and every caller used to answer
    // them with a slightly different sentence. One central toast keeps the wording
    // identical. A page that renders its own state for these (a missing quiz, a private
    // profile) opts out with `skipErrorToast` so the screen does not say it twice.
    if ((status === 403 || status === 404) && !original?.skipErrorToast && !original?.skipAuthHandling) {
      window.dispatchEvent(new CustomEvent(status === 403 ? FORBIDDEN_EVENT : NOT_FOUND_EVENT))
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
