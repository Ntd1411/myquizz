import * as adminRepository from './admin.repository.js'

export async function getAllUsers(offset?: number, limit?: number) {
  const users = await adminRepository.getAllUsers(offset, limit)

  const result = {
    users,
    pagination: {
      offset: offset || 0,
      limit: limit || 20,
      total: await adminRepository.getUsersCount()
    }
  }
  return result
}

export async function deleteUser(id: number) {
  await adminRepository.deleteUser(id)
}
