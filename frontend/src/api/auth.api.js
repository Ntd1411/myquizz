import { http } from './http'
import { unwrap } from './envelope'

// All of these endpoints set or clear HttpOnly cookies as a side effect.
// They never return a usable token to JavaScript.

export async function register({ email, password, fullname, phone }) {
  const res = await http.post('/auth/register', { email, password, fullname, phone })
  return unwrap(res.data).user
}

export async function login({ email, password }) {
  const res = await http.post('/auth/login', { email, password })
  return unwrap(res.data).user
}

export async function logout() {
  const res = await http.post('/auth/logout')
  return unwrap(res.data)
}

/**
 * Google OAuth is a full browser redirect, not an XHR call. The backend redirects
 * back to FRONTEND_URL/auth/callback once the cookies are set.
 */
export function startGoogleLogin() {
  window.location.href = `${import.meta.env.VITE_API_BASE_URL}/auth/google`
}

export async function googleOneTap(credential) {
  const res = await http.post('/auth/google/one-tap', { credential })
  return unwrap(res.data).user
}
