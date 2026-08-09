import { pool } from '../../infrastructure/database/connection.js'
import { toQuizSummary } from './quiz.mapper.js'
import type { QuizSummaryRow } from './quiz.mapper.js'
import type { ListSort, QuizSummary, VisibilityFilter } from './listing.type.js'
import type { ListCursor } from './listing.cursor.js'

/*
 * Read side of the three quiz listing endpoints. Every visibility rule lives in
 * SQL here, never as a .filter() on the result set, so pagination and counts
 * stay correct. Each endpoint has its own visibility constant and its own query
 * function; none of them call each other.
 */

/**
 * Hard ceiling on rows per query, applied on top of the validated request limit
 * as a safety net against a bad value reaching the repository directly.
 */
const MAX_ITEMS_PER_QUERY = 50

/**
 * Every column behind a QuizSummary, q-prefixed for the queries below. Kept in
 * one place so it cannot drift from QuizSummaryRow / toQuizSummary. hot_score,
 * scored_at and deleted_at are intentionally never selected.
 */
const SUMMARY_COLUMNS = `q.id, q.quiz_owner, q.quiz_name, q.quiz_description,
  q.quiz_image, q.quiz_category, q.quiz_language, q.is_public,
  q.question_count, q.play_count, q.completion_rate, q.created_at, q.updated_at,
  u.id as owner_id, u.fullname as owner_fullname, u.avatar as owner_avatar`

/**
 * Author join behind every summary's `owner`.
 *
 * LEFT so a soft-deleted author never drops the quiz out of a listing; the row
 * then carries owner: null. Only the data query joins users — the count query
 * must not, because a primary-key join adds cost without changing the count, and
 * no WHERE condition references u.
 */
const OWNER_JOIN = `left join users u
    on u.id = q.quiz_owner
    and u.deleted_at is null`

/**
 * Search visibility: public quizzes with at least one question, plus everything
 * owned by the caller (private and empty included). $1 is the viewer id, or null
 * for an anonymous caller, in which case `q.quiz_owner = $1` is null and matches
 * nothing.
 *
 * MODERATION NOTE: when home_status lands, add `and q.home_status = 'approved'`
 * to the public branch only. The owner branch must stay unmoderated so authors
 * always find their own quizzes.
 */
const SEARCH_VISIBILITY = `q.deleted_at is null
  and (
    (q.is_public = true and q.question_count > 0)
    or q.quiz_owner = $1
  )`

/**
 * Public profile visibility: one owner's public, non-empty quizzes. No exception
 * for the owner viewing their own profile; that is what GET /quizzes/me is for.
 * $1 is the owner id.
 *
 * MODERATION NOTE: when home_status lands, add `and q.home_status = 'approved'`
 * here too.
 */
const OWNER_PROFILE_VISIBILITY = `q.deleted_at is null
  and q.quiz_owner = $1
  and q.is_public = true
  and q.question_count > 0`

/**
 * Own-quizzes visibility: every non-deleted quiz owned by the caller, optionally
 * narrowed to public or private. $1 is the viewer id, $2 is the visibility
 * filter ('all' | 'public' | 'private').
 *
 * MODERATION NOTE: do NOT add a home_status filter here. Owners must see their
 * own quizzes even while pending or rejected, otherwise they cannot fix them.
 */
const OWN_QUIZZES_VISIBILITY = `q.deleted_at is null
  and q.quiz_owner = $1
  and ($2::text = 'all' or q.is_public = ($2::text = 'public'))`

// Sorts that map straight onto an indexed keyset (everything except relevance).
type KeysetSort = Exclude<ListSort, 'relevance'>

// Sorts accepted by each endpoint. Runtime enums for validation arrive with the
// request schemas; these are only the repository's compile-time contracts.
export type SearchSort = Exclude<ListSort, 'recently_updated'>
export type OwnerProfileSort = 'newest' | 'oldest' | 'most_played' | 'name_asc'
export type OwnQuizzesSort = 'recently_updated' | 'newest' | 'oldest' | 'name_asc'

/** How one sort becomes an ORDER BY, a keyset comparison and a cursor value. */
interface OrderPlan {
  orderExpr: string;
  direction: 'asc' | 'desc';
  cast: string;
  cursorSelect: string;
}

/**
 * Microsecond-precision UTC timestamp for a cursor value. Postgres timestamptz
 * keeps microseconds while Date.toISOString() truncates to milliseconds, so the
 * cursor is emitted straight from SQL and fed back verbatim as $n::timestamptz.
 */
function timestampCursor(column: string): string {
  return `to_char(${column} at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`
}

const KEYSET_PLANS: Record<KeysetSort, OrderPlan> = {
  newest: {
    orderExpr: 'q.created_at',
    direction: 'desc',
    cast: '::timestamptz',
    cursorSelect: timestampCursor('q.created_at')
  },
  oldest: {
    orderExpr: 'q.created_at',
    direction: 'asc',
    cast: '::timestamptz',
    cursorSelect: timestampCursor('q.created_at')
  },
  recently_updated: {
    orderExpr: 'q.updated_at',
    direction: 'desc',
    cast: '::timestamptz',
    cursorSelect: timestampCursor('q.updated_at')
  },
  name_asc: {
    orderExpr: 'lower(q.quiz_name)',
    direction: 'asc',
    cast: '::text',
    cursorSelect: 'lower(q.quiz_name)'
  },
  name_desc: {
    orderExpr: 'lower(q.quiz_name)',
    direction: 'desc',
    cast: '::text',
    cursorSelect: 'lower(q.quiz_name)'
  },
  most_played: {
    orderExpr: 'q.play_count',
    direction: 'desc',
    cast: '::integer',
    cursorSelect: 'q.play_count::text'
  },
  trending: {
    orderExpr: 'q.hot_score',
    direction: 'desc',
    cast: '::double precision',
    cursorSelect: 'q.hot_score::text'
  }
}

/** Filters for GET /quizzes/search, already validated and normalized. */
export interface SearchFilters {
  keyword?: string;
  language?: string;
  category?: string;
  createdFrom?: string;
  createdTo?: string;
  minQuestions?: number;
  minPlays?: number;
  ownerId?: number;
  mine?: boolean;
}

// Row shape returned by the listing queries: a summary plus its cursor value.
interface ListingRow extends QuizSummaryRow {
  cursor_primary: string;
}

/** One page of listing rows, plus the keyset position the next page resumes from. */
export interface ListingRowsPage {
  items: QuizSummary[];
  hasMore: boolean;
  lastPosition: { primaryValue: string; id: number } | null;
}

/**
 * Appends a value to a params array and returns its positional placeholder, so
 * placeholder numbers can never drift out of sync with the array.
 */
function makePush(params: unknown[]): (value: unknown) => string {
  return (value: unknown): string => {
    params.push(value)
    return `$${params.length}`
  }
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit < 1) {
    return 1
  }

  return Math.min(Math.trunc(limit), MAX_ITEMS_PER_QUERY)
}

// relevance cannot be indexed; without a keyword to score, it falls back to newest.
function resolveKeysetSort(sort: ListSort): KeysetSort {
  return sort === 'relevance' ? 'newest' : sort
}

function toRowsPage(rows: ListingRow[], limit: number): ListingRowsPage {
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  const lastRow = page[page.length - 1]

  return {
    items: page.map(toQuizSummary),
    hasMore,
    lastPosition:
      hasMore && lastRow
        ? { primaryValue: lastRow.cursor_primary, id: lastRow.id }
        : null
  }
}

/**
 * Shared tail of every listing query: append the keyset comparison and limit,
 * run the query, and fold the extra look-ahead row into hasMore. The row-value
 * form `(orderExpr, q.id) < ($v, $id)` is what lets Postgres use the keyset
 * indexes rather than sorting.
 */
async function runListingQuery(input: {
  conditions: string[];
  params: unknown[];
  plan: OrderPlan;
  cursor: ListCursor | null;
  limit: number;
}): Promise<ListingRowsPage> {
  const limit = clampLimit(input.limit)
  const push = makePush(input.params)
  const conditions = [...input.conditions]

  if (input.cursor) {
    const op = input.plan.direction === 'desc' ? '<' : '>'
    const valueP = push(input.cursor.primaryValue)
    const idP = push(input.cursor.id)
    conditions.push(
      `(${input.plan.orderExpr}, q.id) ${op} (${valueP}${input.plan.cast}, ${idP}::integer)`
    )
  }

  const limitP = push(limit + 1)

  const result = await pool.query<ListingRow>(
    `select ${SUMMARY_COLUMNS}, ${input.plan.cursorSelect} as cursor_primary
    from quizzes q
    ${OWNER_JOIN}
    where ${conditions.join('\n  and ')}
    order by ${input.plan.orderExpr} ${input.plan.direction}, q.id ${input.plan.direction}
    limit ${limitP}`,
    input.params
  )

  return toRowsPage(result.rows, limit)
}

/** count(*) over an already-built condition set, so it matches the data query exactly. */
async function runCountQuery(conditions: string[], params: unknown[]): Promise<number> {
  const result = await pool.query<{ total: string }>(
    `select count(*) as total
    from quizzes q
    where ${conditions.join('\n  and ')}`,
    params
  )

  return Number(result.rows[0]?.total ?? 0)
}

/**
 * Builds the shared WHERE for search: visibility first (so its param is $1),
 * then the optional filters. Both the data query and the count query start from
 * this exact set, so total can never disagree with the rows.
 */
function buildSearchConditions(
  viewerId: number | null,
  filters: SearchFilters
): { conditions: string[]; params: unknown[] } {
  const params: unknown[] = []
  const push = makePush(params)
  const conditions: string[] = []

  // Visibility must be pushed first to line up with $1 in SEARCH_VISIBILITY.
  push(viewerId)
  conditions.push(SEARCH_VISIBILITY)

  if (filters.keyword) {
    const contains = push(`%${filters.keyword}%`)
    conditions.push(`(q.quiz_name ilike ${contains} or q.quiz_description ilike ${contains})`)
  }

  if (filters.language) {
    conditions.push(`q.quiz_language = ${push(filters.language)}`)
  }

  if (filters.category) {
    conditions.push(`q.quiz_category = ${push(filters.category)}`)
  }

  if (filters.createdFrom) {
    conditions.push(`q.created_at >= ${push(filters.createdFrom)}::timestamptz`)
  }

  if (filters.createdTo) {
    conditions.push(`q.created_at <= ${push(filters.createdTo)}::timestamptz`)
  }

  if (filters.minQuestions !== undefined) {
    conditions.push(`q.question_count >= ${push(filters.minQuestions)}`)
  }

  if (filters.minPlays !== undefined) {
    conditions.push(`q.play_count >= ${push(filters.minPlays)}`)
  }

  if (filters.ownerId !== undefined) {
    conditions.push(`q.quiz_owner = ${push(filters.ownerId)}`)
  }

  // mine restricts to the caller. The service rejects mine=true without a session
  // before reaching here, so a null viewer would simply match nothing.
  if (filters.mine) {
    conditions.push(`q.quiz_owner = ${push(viewerId)}`)
  }

  return { conditions, params }
}

/**
 * A page of search results. Anonymous callers see public, non-empty quizzes;
 * authenticated callers additionally see their own private and empty quizzes.
 */
export async function searchQuizzes(input: {
  viewerId: number | null;
  filters: SearchFilters;
  sort: SearchSort;
  cursor: ListCursor | null;
  limit: number;
}): Promise<ListingRowsPage> {
  const { conditions, params } = buildSearchConditions(input.viewerId, input.filters)

  let plan: OrderPlan

  if (input.sort === 'relevance' && input.filters.keyword) {
    const push = makePush(params)
    const keyword = input.filters.keyword
    const exact = push(keyword)
    const prefix = push(`${keyword}%`)
    const contains = push(`%${keyword}%`)
    // Integer match score, recomputed wherever it appears so it stays one string:
    // exact name beats prefix beats substring, with a small description bonus.
    const rank = `((case when lower(q.quiz_name) = lower(${exact}) then 100 else 0 end) + (case when q.quiz_name ilike ${prefix} then 40 else 0 end) + (case when q.quiz_name ilike ${contains} then 20 else 0 end) + (case when q.quiz_description ilike ${contains} then 10 else 0 end))`
    plan = {
      orderExpr: rank,
      direction: 'desc',
      cast: '::integer',
      cursorSelect: `(${rank})::text`
    }
  } else {
    plan = KEYSET_PLANS[resolveKeysetSort(input.sort)]
  }

  return runListingQuery({
    conditions,
    params,
    plan,
    cursor: input.cursor,
    limit: input.limit
  })
}

/** count(*) for search, over the exact same WHERE as searchQuizzes. */
export async function countSearchQuizzes(input: {
  viewerId: number | null;
  filters: SearchFilters;
}): Promise<number> {
  const { conditions, params } = buildSearchConditions(input.viewerId, input.filters)
  return runCountQuery(conditions, params)
}

function buildOwnerConditions(ownerId: number): { conditions: string[]; params: unknown[] } {
  const params: unknown[] = []
  const push = makePush(params)

  // Visibility must be pushed first to line up with $1 in OWNER_PROFILE_VISIBILITY.
  push(ownerId)

  return { conditions: [OWNER_PROFILE_VISIBILITY], params }
}

/** A page of one owner's public profile. Never exposes private or empty quizzes. */
export async function getPublicQuizzesByOwner(input: {
  ownerId: number;
  sort: OwnerProfileSort;
  cursor: ListCursor | null;
  limit: number;
}): Promise<ListingRowsPage> {
  const { conditions, params } = buildOwnerConditions(input.ownerId)

  return runListingQuery({
    conditions,
    params,
    plan: KEYSET_PLANS[input.sort],
    cursor: input.cursor,
    limit: input.limit
  })
}

/** count(*) for a public profile, over the exact same WHERE. */
export async function countPublicQuizzesByOwner(ownerId: number): Promise<number> {
  const { conditions, params } = buildOwnerConditions(ownerId)
  return runCountQuery(conditions, params)
}

function buildOwnConditions(
  viewerId: number,
  visibility: VisibilityFilter,
  keyword?: string
): { conditions: string[]; params: unknown[] } {
  const params: unknown[] = []
  const push = makePush(params)
  const conditions: string[] = []

  // Visibility must be pushed first to line up with $1 and $2 in
  // OWN_QUIZZES_VISIBILITY.
  push(viewerId)
  push(visibility)
  conditions.push(OWN_QUIZZES_VISIBILITY)

  if (keyword) {
    const contains = push(`%${keyword}%`)
    conditions.push(`(q.quiz_name ilike ${contains} or q.quiz_description ilike ${contains})`)
  }

  return { conditions, params }
}

/** A page of the caller's own quizzes, including private and empty ones. */
export async function getOwnQuizzes(input: {
  viewerId: number;
  visibility: VisibilityFilter;
  keyword?: string;
  sort: OwnQuizzesSort;
  cursor: ListCursor | null;
  limit: number;
}): Promise<ListingRowsPage> {
  const { conditions, params } = buildOwnConditions(
    input.viewerId,
    input.visibility,
    input.keyword
  )

  return runListingQuery({
    conditions,
    params,
    plan: KEYSET_PLANS[input.sort],
    cursor: input.cursor,
    limit: input.limit
  })
}

/** count(*) for the caller's own quizzes, over the exact same WHERE. */
export async function countOwnQuizzes(input: {
  viewerId: number;
  visibility: VisibilityFilter;
  keyword?: string;
}): Promise<number> {
  const { conditions, params } = buildOwnConditions(
    input.viewerId,
    input.visibility,
    input.keyword
  )
  return runCountQuery(conditions, params)
}
