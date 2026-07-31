import { http } from './http'
import { unwrap } from './envelope'

export async function getMe() {
  const res = await http.get('/users/me')
  return unwrap(res.data).user
}

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
