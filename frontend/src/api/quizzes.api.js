import { http } from './http'
import { unwrap, readPagination } from './envelope'

/**
 * Search / browse quizzes.
 * The backend caps `limit` at 20.
 * Returns both the items and the meta.pagination block.
 */
export async function searchQuizzes({ keyword, language, category, page = 1, limit = 12 } = {}) {
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

export async function getQuizzesByOwner(ownerId, { page = 1, limit = 12 } = {}) {
  const res = await http.get(`/quizzes/users/id/${ownerId}`, { params: { page, limit } })
  return {
    quizzes: unwrap(res.data).quizzes ?? [],
    pagination: readPagination(res.data),
  }
}

export async function getQuizById(quizId) {
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
