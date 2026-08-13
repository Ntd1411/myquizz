import { http } from './http'
import { unwrap } from './envelope'

/**
 * Reads the current session from the backend.
 *
 * `/users/me` is the only source of truth for the login state: the tokens live in
 * HttpOnly cookies, so JavaScript can never inspect them directly.
 *
 * Pass `{ probe: true }` for the app-start check. A 401 then means "guest" and
 * must not run the refresh-and-retry cycle nor raise the session-expired event.
 */
export async function getMe({ probe = false } = {}) {
  const res = await http.get('/users/me', { skipAuthHandling: probe })
  return unwrap(res.data).user
}

/**
 * PATCH /users/me. The backend schema accepts fullname, phone and description, all
 * optional, and rejects a phone already taken by another account with a 400.
 *
 * Email is NOT accepted. The address is what Google sign-in falls back on to recognise
 * an account, so it is frozen server side and the body is strict: sending an email key
 * answers 400 rather than being ignored.
 */
export async function updateMe(patch) {
  const res = await http.patch('/users/me', patch)
  return unwrap(res.data).user
}

export async function changePassword({ oldPassword, newPassword }) {
  const res = await http.patch('/users/me/password', { oldPassword, newPassword })
  return unwrap(res.data)
}

/**
 * Avatar is NOT a multipart upload. Upload the image through /storage/presign first,
 * then send the resulting publicUrl here as `fileUrl`.
 */
export async function updateAvatar(fileUrl) {
  const res = await http.patch('/users/me/avatar', { fileUrl })
  return unwrap(res.data).avatarUrl
}

/**
 * DELETE /users/me soft-deletes (deactivates) the account and requires the current
 * password in the body, so it is sent through the `data` option of axios.
 */
export async function deactivateAccount(password) {
  const res = await http.delete('/users/me', { data: { password } })
  return unwrap(res.data)
}

export async function getPublicUser(userId) {
  const res = await http.get(`/users/${userId}`)
  return unwrap(res.data).user
}

export async function forgotPassword(email) {
  const res = await http.post('/users/forgot-password', { email })
  return unwrap(res.data)
}

export async function resetPassword({ email, otp, newPassword }) {
  const res = await http.post('/users/reset-password', { email, otp, newPassword })
  return unwrap(res.data)
}
