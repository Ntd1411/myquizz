import mock from '@/mocks/mock.json'

/**
 * Temporary mock data layer.
 *
 * The backend is the default source now, so mocking is opt-in: set
 * `VITE_USE_MOCK=true` to browse quizzes from `src/mocks/mock.json` without a server.
 * Categories and game-mode blurbs are static decoration and are used by the real
 * pages as well.
 *
 * Mock pages follow the same cursor contract as the API (an opaque `nextCursor`
 * string plus `hasMore`) so paging can be developed offline.
 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// Small artificial latency so loading states are actually visible in dev.
const LATENCY_MS = 220

function delay(value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS))
}

/** The mock cursor is only the offset of the next row, encoded as a string. */
function decodeCursor(cursor) {
  const offset = Number(cursor)
  return Number.isFinite(offset) && offset > 0 ? offset : 0
}

function cursorPage(items, { cursor, limit, includeTotal }) {
  const offset = decodeCursor(cursor)
  const slice = items.slice(offset, offset + limit)
  const nextOffset = offset + slice.length
  const hasMore = nextOffset < items.length

  return {
    quizzes: slice,
    pagination: {
      limit,
      nextCursor: hasMore ? String(nextOffset) : null,
      hasMore,
      total: includeTotal ? items.length : undefined,
    },
  }
}

function sortItems(items, sort) {
  const list = [...items]
  if (sort === 'newest') {
    return list.sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))
  }
  if (sort === 'oldest') {
    return list.sort((a, b) => new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0))
  }
  if (sort === 'name_asc') return list.sort((a, b) => String(a.title).localeCompare(String(b.title)))
  if (sort === 'name_desc') return list.sort((a, b) => String(b.title).localeCompare(String(a.title)))
  if (sort === 'most_played' || sort === 'trending') {
    return list.sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0))
  }
  return list
}

export function mockSearchQuizzes({
  keyword,
  language,
  category,
  sort,
  cursor,
  limit = 12,
  includeTotal = false,
} = {}) {
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

  return delay(cursorPage(sortItems(filtered, sort), { cursor, limit, includeTotal }))
}

export function mockGetQuizById(quizId) {
  const found = mock.quizzes.find((quiz) => quiz.id === quizId) ?? mock.quizzes[0]
  // Detail view needs a question list; the mock file keeps one shared sample set.
  return delay({ ...found, questions: mock.questions })
}

export const mockCategories = mock.categories
export const mockModes = mock.modes
