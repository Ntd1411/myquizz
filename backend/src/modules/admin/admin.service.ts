import * as adminRepository from './admin.repository.js'
import type { UserStatusFilter } from './admin.schema.js'

/** Mirrors the default in AdminSchema, for callers that reach the service directly. */
const DEFAULT_LIMIT = 20

export async function getAllUsers(offset = 0, limit = DEFAULT_LIMIT, status: UserStatusFilter = 'all') {
  /*
   * The count takes the same filter as the listing. Reported back with the page so the
   * client can size its pager without repeating the assumption, and issued alongside
   * the listing rather than after it - the two queries are independent.
   */
  const [users, total] = await Promise.all([
    adminRepository.getAllUsers(offset, limit, status),
    adminRepository.getUsersCount(status)
  ])

  return {
    users,
    pagination: { offset, limit, total, status }
  }
}

export async function deleteUser(id: number) {
  await adminRepository.deleteUser(id)
}

export async function restoreUser(id: number) {
  await adminRepository.restoreUser(id)
}
