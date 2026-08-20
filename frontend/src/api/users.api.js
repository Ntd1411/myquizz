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

/**
 * A reset runs in three steps, and the password is only written by the last one:
 *   1. forgotPassword(email)                emails a 6-digit code AND a link
 *   2. verifyResetCode / verifyResetLink    exchanges either one for a ticket
 *   3. completeReset({ ticket, ... })       writes the new password
 *
 * Neither the code nor the emailed token can set a password on its own, so the reset
 * form is reachable only with a ticket, and a replayed URL no longer opens it.
 */

/**
 * Step two with the six-digit code. The address is required next to it: the code alone
 * does not name the account it belongs to. Five wrong codes delete the outstanding one
 * and answer 429, which means a new email is needed rather than another guess.
 *
 * Answers { ticket, expiresAt, email }, where the address comes back masked so the
 * reset screen can name it without printing it.
 */
export async function verifyResetCode({ email, otp }) {
  const res = await http.post('/users/password-reset/verify', { email, otp })
  return unwrap(res.data)
}

/**
 * Step two with the emailed link, which carries its own address, so nothing has to be
 * typed. The body is strict: a token must travel alone, never beside an otp.
 *
 * Verifying SPENDS the proof - the code, the link and the resend cooldown are dropped
 * server side - so this runs exactly once per email.
 */
export async function verifyResetLink(token) {
  const res = await http.post('/users/password-reset/verify', { token })
  return unwrap(res.data)
}

/**
 * Reads a ticket WITHOUT spending it, so the reset screen can decide what to render
 * before it shows a form: a dead ticket then explains itself instead of failing after
 * the password has been typed twice. Answers { email, expiresAt }.
 */
export async function getResetTicket(ticket) {
  const res = await http.get('/users/password-reset/ticket', { params: { ticket } })
  return unwrap(res.data)
}

/**
 * Step three, the only place that writes a password. It accepts the ticket and never
 * the code or the emailed token, the ticket is single use, and the new password must
 * differ from the current one. Every refresh token of the account is revoked, so any
 * session opened by whoever locked the owner out does not survive the reset.
 */
export async function completeReset({ ticket, newPassword }) {
  const res = await http.post('/users/password-reset/complete', { ticket, newPassword })
  return unwrap(res.data)
}
