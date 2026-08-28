import { z } from 'zod'
import { LIST_SORTS, VISIBILITY_FILTERS } from './listing.type.js'

/**
 * The range a question's time limit is held to, mirrored by LIMITS.timeMin /
 * LIMITS.timeMax in frontend/src/utils/quizImport.js.
 *
 * The floor used to be 0, which let a question nobody can answer through the one check
 * that is not optional. A limit is now a real playing time on both sides of the wire.
 */
export const TIME_LIMIT_MIN = 5
export const TIME_LIMIT_MAX = 600

export const createQuestionSchema = z.object({
  question_type: z.enum(['multiple_choice', 'multiple_select', 'short_answer', 'long_answer']),
  question_text: z.string().min(1, 'Question must be at least 1 character').max(200, 'Question must be at most 200 characters'),
  time_limit: z.number().int('Time limit must be whole seconds')
    .min(TIME_LIMIT_MIN, `Time limit must be at least ${TIME_LIMIT_MIN} seconds`)
    .max(TIME_LIMIT_MAX, `Time limit must be at most ${TIME_LIMIT_MAX} seconds`)
    .default(30),
  question_image: z.url('Must be valid URL').optional(),
  // Both columns are varchar(255), so a longer string is refused here instead of
  // reaching the driver and surfacing as a 500.
  question_hint: z.string().max(255, 'Hint must be at most 255 characters').optional(),
  explanation: z.string().max(255, 'Explanation must be at most 255 characters').optional(),
  answer_options: z.array(z.string().min(1, 'Option must be at least 1 character').max(100, 'Option must be at most 100 characters'))
    .min(2, 'Question must have at least 2 options')
    .max(4, 'Question can have at most 4 options').optional(),
  correct_answer: z.union([
    z.array(z.number().int().min(0)).min(1, 'At least one correct answer is required'),
    z.string().min(1, 'Correct answer is required')])
})

export const createQuizSchema = z.object({
  quiz_name: z.string().min(3, 'Quiz name at least 3 chars').max(100, 'Quiz name must be at most 100 characters'),
  quiz_description: z.string().max(500, 'Quiz description must be at most 500 characters').optional(),
  quiz_language: z.string().min(1, 'Language is required'),
  quiz_image: z.url('Must be valid URL').optional(),
  quiz_category: z.string().max(50, 'Quiz category must be at most 50 characters').optional(),
  is_public: z.boolean(),
  questions: z.array(createQuestionSchema).min(1, 'Quiz must have at least 1 question')
})

export const updateQuizSchema = createQuizSchema.partial()

/*
 * Shared building blocks for the listing endpoints.
 *
 * Everything in req.query is a string, so each parameter is validated as text
 * first and only then converted. A missing parameter means "no filter"; an
 * unparsable one is a 400 here rather than a NaN or a driver error deeper down.
 */

/** Largest integer a query parameter may carry, used where there is no natural cap. */
const MAX_INT = Number.MAX_SAFE_INTEGER

export function intQuery(min: number, max: number = MAX_INT) {
  return z.string().regex(/^\d+$/, 'Must be a non-negative integer')
    .transform(Number)
    .pipe(z.number().int().min(min).max(max))
}

// Only the literal strings are accepted: 'yes', '1' or '' would each be a
// different guess about intent, and guessing here hides client bugs.
export const boolQuery = z.enum(['true', 'false']).transform((value) => value === 'true')

export const dateOnlyQuery = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a YYYY-MM-DD date')

/**
 * Listing cursor. It stays opaque to the client, so it is only length-capped
 * here; its contents are validated when decoded in listing.cursor.ts, which
 * turns anything malformed or replayed into a 400 instead of a 500.
 */
const cursorQuery = z.string().trim().min(1).max(300)

const limitQuery = intQuery(1, 24)

const keywordQuery = z.string().trim().max(200)

// Sorts accepted per endpoint. Subsets of LIST_SORTS, referenced through it so a
// renamed sort fails to compile instead of silently becoming invalid at runtime.
export const SEARCH_SORTS = LIST_SORTS.filter(
  (sort) => sort !== 'recently_updated'
)

export const OWNER_PROFILE_SORTS = ['newest', 'oldest', 'most_played', 'name_asc'] as const

export const MY_QUIZZES_SORTS = ['recently_updated', 'newest', 'oldest', 'name_asc'] as const

/**
 * Query for the cursor-based home feed.
 *
 * Kept on its own cursor format and its own parameter names; merging it into the
 * listing schemas is a later cleanup, not part of this change.
 */
export const feedQuerySchema = z.object({
  topic: z.string().trim().max(50).optional(),
  cursor: z.string().trim().max(200).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number)
    .pipe(z.number().int().min(1).max(24)).default(12)
})

/**
 * Query for GET /quizzes/search.
 *
 * sort has no default here on purpose: the service picks relevance when a
 * keyword is present and newest otherwise, which a schema-level default cannot
 * express. mine is not checked against the session here either, because a schema
 * cannot see req.user; the service rejects mine=true for anonymous callers.
 */
export const searchQuizzesSchema = z.object({
  keyword: keywordQuery.optional(),
  language: z.string().trim().max(50).optional(),
  category: z.string().trim().max(100).optional(),
  // Dates widen to the full day so an inclusive range reads naturally: from the
  // first microsecond of created_from to the last one of created_to.
  created_from: dateOnlyQuery.transform((day) => `${day}T00:00:00.000000Z`).optional(),
  created_to: dateOnlyQuery.transform((day) => `${day}T23:59:59.999999Z`).optional(),
  min_questions: intQuery(0).optional(),
  min_plays: intQuery(0).optional(),
  owner_id: intQuery(1).optional(),
  mine: boolQuery.default(false),
  sort: z.enum(SEARCH_SORTS).optional(),
  cursor: cursorQuery.optional(),
  limit: limitQuery.default(12),
  include_total: boolQuery.default(false)
}).refine(
  (query) =>
    !query.created_from || !query.created_to || query.created_from <= query.created_to,
  {
    // Caught here rather than left to the query, where an inverted range would
    // return an empty page that looks like "no results" instead of a mistake.
    message: 'created_from must not be after created_to',
    path: ['created_from']
  }
)

/** Query for GET /quizzes/users/id/:ownerId. No visibility parameter: the endpoint is always public-only. */
export const ownerQuizzesQuerySchema = z.object({
  sort: z.enum(OWNER_PROFILE_SORTS).default('newest'),
  cursor: cursorQuery.optional(),
  limit: limitQuery.default(12),
  include_total: boolQuery.default(false)
})

/** Query for GET /quizzes/me. */
export const myQuizzesQuerySchema = z.object({
  visibility: z.enum(VISIBILITY_FILTERS).default('all'),
  keyword: keywordQuery.optional(),
  sort: z.enum(MY_QUIZZES_SORTS).default('recently_updated'),
  cursor: cursorQuery.optional(),
  limit: limitQuery.default(12),
  include_total: boolQuery.default(false)
})

export const quizIdParamSchema = z.object({
  quizId: intQuery(1)
})

export const ownerIdParamSchema = z.object({
  ownerId: intQuery(1)
})

export type UpdateQuizRequest = z.infer<typeof updateQuizSchema>
export type CreateQuizRequest = z.infer<typeof createQuizSchema>
export type CreateQuestionRequest = z.infer<typeof createQuestionSchema>
export type FeedQuery = z.infer<typeof feedQuerySchema>
export type SearchQuizzesQuery = z.infer<typeof searchQuizzesSchema>
export type OwnerQuizzesQuery = z.infer<typeof ownerQuizzesQuerySchema>
export type MyQuizzesQuery = z.infer<typeof myQuizzesQuerySchema>
export type QuizIdParams = z.infer<typeof quizIdParamSchema>
export type OwnerIdParams = z.infer<typeof ownerIdParamSchema>
