import { http } from './http'
import { unwrap, readPagination, readCached } from './envelope'
import { toQuizCards, toHomeSection, toQuizDetail } from './quiz.mapper'

/**
 * Quiz REST layer.
 *
 * Every listing endpoint (/quizzes/search, /quizzes/me, /quizzes/users/id/:ownerId,
 * /quizzes/home, /quizzes/feed) uses keyset (cursor) pagination. There is no `page`
 * parameter any more: pass the previous `meta.pagination.nextCursor` back verbatim to
 * get the next page.
 *
 * A cursor is bound to the sort and to the full filter set it was created with, so
 * changing any filter or the sort must restart from the first page, otherwise the
 * backend answers 400 "Invalid cursor". `limit` is not part of that binding and may
 * change between pages.
 */

// backend/src/modules/quiz/quiz.schema.ts: limit is intQuery(1, 24), default 12.
const MAX_LIMIT = 24
const DEFAULT_LIMIT = 12

function limitOf(limit) {
  const value = Number(limit) || DEFAULT_LIMIT
  return Math.min(Math.max(Math.trunc(value), 1), MAX_LIMIT)
}

/** The backend only accepts the literal strings 'true' and 'false' for booleans. */
function boolParam(value) {
  if (value === undefined || value === null || value === '') return undefined
  return value ? 'true' : 'false'
}

function textParam(value) {
  const text = typeof value === 'string' ? value.trim() : value
  return text ? text : undefined
}

function numberParam(value) {
  return value === undefined || value === null || value === '' ? undefined : Number(value)
}

/** Shared shape returned by every quiz listing: mapped cards plus the cursor block. */
function toListPage(res) {
  return {
    quizzes: toQuizCards(unwrap(res.data).quizzes),
    pagination: readPagination(res.data),
  }
}

/**
 * Public search / browse. Signed-in owners additionally see their own private and
 * empty quizzes, which is handled by the backend query, not by the client.
 *
 * Sorts: relevance | newest | oldest | name_asc | name_desc | most_played | trending.
 * There is no default sort: the backend falls back to relevance when a keyword is
 * present and to newest otherwise.
 */
export async function searchQuizzes({
  keyword,
  language,
  category,
  sort,
  ownerId,
  mine,
  createdFrom,
  createdTo,
  minQuestions,
  minPlays,
  cursor,
  limit,
  includeTotal,
} = {}) {
  const res = await http.get('/quizzes/search', {
    params: {
      keyword: textParam(keyword),
      language: textParam(language),
      category: textParam(category),
      sort: textParam(sort),
      owner_id: textParam(ownerId),
      mine: boolParam(mine),
      created_from: textParam(createdFrom),
      created_to: textParam(createdTo),
      min_questions: numberParam(minQuestions),
      min_plays: numberParam(minPlays),
      cursor: textParam(cursor),
      limit: limitOf(limit),
      // A total costs an extra COUNT, so it is only ever asked for on the first page.
      include_total: cursor ? undefined : boolParam(includeTotal),
    },
  })
  return toListPage(res)
}

/**
 * The signed-in user's own quizzes, including private ones and quizzes without any
 * question yet. Requires authentication.
 *
 * Sorts: recently_updated (default) | newest | oldest | name_asc.
 * Visibility: all (default) | public | private.
 */
export async function getMyQuizzes({
  keyword,
  visibility,
  sort,
  cursor,
  limit,
  includeTotal,
} = {}) {
  const res = await http.get('/quizzes/me', {
    params: {
      keyword: textParam(keyword),
      visibility: textParam(visibility),
      sort: textParam(sort),
      cursor: textParam(cursor),
      limit: limitOf(limit),
      include_total: cursor ? undefined : boolParam(includeTotal),
    },
  })
  return toListPage(res)
}

/**
 * Someone's public profile listing. This endpoint is public and always returns the
 * same rows for everybody, so the owner does not see their private quizzes here.
 *
 * Sorts: newest (default) | oldest | most_played | name_asc.
 */
export async function getQuizzesByOwner(ownerId, { sort, cursor, limit, includeTotal } = {}) {
  const res = await http.get(`/quizzes/users/id/${ownerId}`, {
    params: {
      sort: textParam(sort),
      cursor: textParam(cursor),
      limit: limitOf(limit),
      include_total: cursor ? undefined : boolParam(includeTotal),
    },
  })
  return toListPage(res)
}

/**
 * Home rows. The sections, their order and their titles are configured server side
 * in the `home_sections` table; empty sections are already dropped by the backend and
 * the "continue" row only appears for a signed-in user.
 */
export async function getHomeSections() {
  const res = await http.get('/quizzes/home')
  const sections = unwrap(res.data).sections ?? []
  return {
    sections: sections.map(toHomeSection),
    cached: readCached(res.data),
  }
}

/**
 * Endless feed ranked by `hot_score`, which is computed by the scoring job and not
 * at request time. Its cursor is a separate `hot_score|id` pair, so an invalid one
 * fails with 400 "Invalid feed cursor".
 */
export async function getFeed({ topic, cursor, limit } = {}) {
  const res = await http.get('/quizzes/feed', {
    params: {
      topic: textParam(topic),
      cursor: textParam(cursor),
      limit: limitOf(limit),
    },
  })
  return {
    ...toListPage(res),
    cached: readCached(res.data),
  }
}

/**
 * The detail endpoint returns the quiz row with its questions, which is a
 * different shape from the listing cards, so it goes through toQuizDetail.
 * Create and update answer with that very same shape.
 */
export async function getQuizById(quizId) {
  const res = await http.get(`/quizzes/id/${quizId}`)
  return toQuizDetail(unwrap(res.data).quiz)
}

export async function createQuiz(payload) {
  const res = await http.post('/quizzes', payload)
  return toQuizDetail(unwrap(res.data).quiz)
}

/**
 * PATCH is a partial update for the metadata, but `questions` is not merged:
 * sending it replaces the entire question list, so the caller must always send
 * the complete list it wants to keep.
 */
export async function updateQuiz(quizId, patch) {
  const res = await http.patch(`/quizzes/id/${quizId}`, patch)
  return toQuizDetail(unwrap(res.data).quiz)
}

// Soft delete answers with the raw deleted row, which carries no questions.
export async function deleteQuiz(quizId) {
  const res = await http.delete(`/quizzes/id/${quizId}`)
  return unwrap(res.data).quiz
}
