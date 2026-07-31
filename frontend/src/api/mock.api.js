import mock from '@/mocks/mock.json'

/**
 * Temporary mock data layer.
 *
 * While the backend is not wired up locally, every quiz read is served from
 * `src/mocks/mock.json`. Set `VITE_USE_MOCK=false` in the environment to hit the
 * real REST API instead. Delete this file once the backend is always available.
 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

// Small artificial latency so loading states are actually visible in dev.
const LATENCY_MS = 220

function delay(value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS))
}

function paginate(items, page, limit) {
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / limit))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * limit
  return {
    quizzes: items.slice(start, start + limit),
    pagination: {
      page: safePage,
      limit,
      totalItems,
      totalPages,
      hasPreviousPage: safePage > 1,
      hasNextPage: safePage < totalPages,
    },
  }
}

export function mockSearchQuizzes({ keyword, language, category, page = 1, limit = 12 } = {}) {
  const needle = (keyword || '').trim().toLowerCase()

  const filtered = mock.quizzes.filter((quiz) => {
    if (category && quiz.category !== category) return false
    if (language && quiz.language !== language) return false
    if (!needle) return true
    return (
      quiz.title.toLowerCase().includes(needle) ||
      (quiz.description || '').toLowerCase().includes(needle)
    )
  })

  return delay(paginate(filtered, page, limit))
}

export function mockGetQuizzesByOwner(ownerId, { page = 1, limit = 12 } = {}) {
  const owned = mock.quizzes.filter((quiz) => quiz.owner?.id === ownerId)
  // Any signed-in mock user sees the first author's set, otherwise the library
  // would always look empty against a real account id.
  const items = owned.length ? owned : mock.quizzes.slice(0, 6)
  return delay(paginate(items, page, limit))
}

export function mockGetQuizById(quizId) {
  const found = mock.quizzes.find((quiz) => quiz.id === quizId) ?? mock.quizzes[0]
  // Detail view needs a question list; the mock file keeps one shared sample set.
  return delay({ ...found, questions: mock.questions })
}

export const mockCategories = mock.categories
export const mockModes = mock.modes
