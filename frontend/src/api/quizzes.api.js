import { http } from './http'
import { unwrap, readPagination } from './envelope'
import {
  USE_MOCK,
  mockSearchQuizzes,
  mockGetQuizById,
} from './mock.api'

/**
 * Search / browse quizzes.
 * The backend caps `limit` at 20.
 * Returns both the items and the meta.pagination block.
 *
 * While `VITE_USE_MOCK` is not set to "false", browse reads are served from
 * `src/mocks/mock.json` so the public pages can be developed without a backend.
 */
export async function searchQuizzes({ keyword, language, category, page = 1, limit = 12 } = {}) {
  if (USE_MOCK) return mockSearchQuizzes({ keyword, language, category, page, limit })

  const res = await http.get('/quizzes/search', {
    params: {
      keyword: keyword || undefined,
      language: language || undefined,
      category: category || undefined,
      page,
      limit: Math.min(limit, 20),
    },
  })
  return {
    quizzes: unwrap(res.data).quizzes ?? [],
    pagination: readPagination(res.data),
  }
}

/**
 * Quizzes owned by one user. This is never mocked: "My library" must show the rows
 * that really exist for the signed-in account, otherwise a freshly created quiz
 * would be missing from it.
 */
export async function getQuizzesByOwner(ownerId, { page = 1, limit = 12 } = {}) {
  const res = await http.get(`/quizzes/users/id/${ownerId}`, {
    params: { page, limit: Math.min(limit, 20) },
  })
  return {
    quizzes: unwrap(res.data).quizzes ?? [],
    pagination: readPagination(res.data),
  }
}

export async function getQuizById(quizId) {
  if (USE_MOCK) return mockGetQuizById(quizId)

  const res = await http.get(`/quizzes/id/${quizId}`)
  return unwrap(res.data).quiz
}

export async function createQuiz(payload) {
  const res = await http.post('/quizzes', payload)
  return unwrap(res.data).quiz
}

export async function updateQuiz(quizId, patch) {
  const res = await http.patch(`/quizzes/id/${quizId}`, patch)
  return unwrap(res.data).quiz
}

export async function deleteQuiz(quizId) {
  const res = await http.delete(`/quizzes/id/${quizId}`)
  return unwrap(res.data).quiz
}
