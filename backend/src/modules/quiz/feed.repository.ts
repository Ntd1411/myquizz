import { pool } from '../../infrastructure/database/connection.js'
import type { FeedCursor } from './feed.cursor.js'
import type { HomeSectionConfig, QuizCard, SectionType } from './home.type.js'

/**
 * Single source of truth for "may this quiz appear in a public listing".
 *
 * When moderation lands, add one line here — `and q.home_status = 'approved'` —
 * and every listing below inherits it. Remember that quizzes_feed_idx must be
 * dropped and recreated with the same predicate at that point, otherwise the
 * partial index stops matching the query and the feed falls back to a sort.
 *
 * `question_count > 0` is the only quality gate in this version. It hides
 * quizzes created and abandoned before a single question was added, which is the
 * most common junk row while the app has no outside users.
 */
const PUBLIC_FEED_FILTER = `
  q.deleted_at is null
  and q.is_public = true
  and q.question_count > 0
`

/**
 * Columns behind every quiz card, in one place so the mapper below stays in sync.
 * hot_score is deliberately absent: it is a ranking detail the client never sees,
 * and it is selected explicitly only by the feed query that needs it for cursors.
 */
const CARD_COLUMNS = `
  q.id, q.quiz_name, q.quiz_description, q.quiz_image, q.quiz_category,
  q.quiz_language, q.quiz_owner, q.question_count, q.play_count,
  q.completion_rate, q.created_at
`

/**
 * Hard ceiling on rows per query, applied on top of the validated request limit.
 * home_sections.item_limit is operator-editable data, so a typo there must not
 * turn into a thousand-row scan.
 */
const MAX_ITEMS_PER_QUERY = 50

interface QuizCardRow {
  id: number;
  quiz_name: string;
  quiz_description: string | null;
  quiz_image: string | null;
  quiz_category: string | null;
  quiz_language: string;
  quiz_owner: number;
  question_count: number;
  play_count: number;
  completion_rate: number;
  created_at: Date | string;
}

interface FeedRow extends QuizCardRow {
  hot_score: number;
}

interface HomeSectionRow {
  id: number;
  section_key: string;
  title: string;
  section_type: SectionType;
  category_name: string | null;
  item_limit: number;
  position: number;
  is_active: boolean;
}

/** One page of feed rows, plus where the next page should resume from. */
export interface FeedRowsPage {
  items: QuizCard[];
  hasMore: boolean;
  lastPosition: FeedCursor | null;
}

/**
 * The only place a database row becomes a client-facing card.
 *
 * `created_at` is normalised here because node-postgres returns a Date object
 * for timestamp columns while the API contract is an ISO string. Numeric columns
 * are coerced because pg returns bigint-ish aggregates as strings.
 */
function toQuizCard(row: QuizCardRow): QuizCard {
  return {
    id: row.id,
    quiz_name: row.quiz_name,
    quiz_description: row.quiz_description,
    quiz_image: row.quiz_image,
    quiz_category: row.quiz_category,
    quiz_language: row.quiz_language,
    quiz_owner: row.quiz_owner,
    question_count: Number(row.question_count),
    play_count: Number(row.play_count),
    completion_rate: Number(row.completion_rate),
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at
  }
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit < 1) {
    return 1
  }

  return Math.min(Math.trunc(limit), MAX_ITEMS_PER_QUERY)
}

/**
 * Keyset page of the public feed, ordered by (hot_score desc, id desc).
 *
 * The row-comparison form `(q.hot_score, q.id) < ($2, $3)` is what lets
 * quizzes_feed_idx serve this as an index scan; an OR of two conditions would
 * not. Both cursor parameters are null on the first page, and the guard in front
 * of the comparison short-circuits it, since a row comparison against null
 * yields null rather than true.
 *
 * One extra row beyond the limit is fetched to decide `hasMore` without a
 * separate count query.
 */
export async function getFeedPage(params: {
  cursor: FeedCursor | null;
  limit: number;
  category?: string | undefined;
}): Promise<FeedRowsPage> {
  const limit = clampLimit(params.limit)

  const result = await pool.query<FeedRow>(
    `select ${CARD_COLUMNS}, q.hot_score
    from quizzes q
    where ${PUBLIC_FEED_FILTER}
      and ($1::text is null or q.quiz_category = $1)
      and (
        $2::double precision is null
        or (q.hot_score, q.id) < ($2::double precision, $3::integer)
      )
    order by q.hot_score desc, q.id desc
    limit $4`,
    [
      params.category ?? null,
      params.cursor?.hotScore ?? null,
      params.cursor?.id ?? null,
      limit + 1
    ]
  )

  const hasMore = result.rows.length > limit
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows
  const lastRow = rows[rows.length - 1]

  return {
    items: rows.map(toQuizCard),
    hasMore,
    lastPosition:
      hasMore && lastRow
        ? { hotScore: Number(lastRow.hot_score), id: lastRow.id }
        : null
  }
}

/** Staff picks: manually flagged quizzes, best scoring first. */
export async function getFeaturedQuizzes(limit: number): Promise<QuizCard[]> {
  const result = await pool.query<QuizCardRow>(
    `select ${CARD_COLUMNS}
    from quizzes q
    where ${PUBLIC_FEED_FILTER}
      and q.is_featured = true
    order by q.hot_score desc, q.id desc
    limit $1`,
    [clampLimit(limit)]
  )

  return result.rows.map(toQuizCard)
}

/** Same ordering as the feed's first page. */
export async function getTrendingQuizzes(limit: number): Promise<QuizCard[]> {
  const result = await pool.query<QuizCardRow>(
    `select ${CARD_COLUMNS}
    from quizzes q
    where ${PUBLIC_FEED_FILTER}
    order by q.hot_score desc, q.id desc
    limit $1`,
    [clampLimit(limit)]
  )

  return result.rows.map(toQuizCard)
}

export async function getNewestQuizzes(limit: number): Promise<QuizCard[]> {
  const result = await pool.query<QuizCardRow>(
    `select ${CARD_COLUMNS}
    from quizzes q
    where ${PUBLIC_FEED_FILTER}
    order by q.created_at desc, q.id desc
    limit $1`,
    [clampLimit(limit)]
  )

  return result.rows.map(toQuizCard)
}

export async function getCategoryQuizzes(
  category: string,
  limit: number
): Promise<QuizCard[]> {
  const result = await pool.query<QuizCardRow>(
    `select ${CARD_COLUMNS}
    from quizzes q
    where ${PUBLIC_FEED_FILTER}
      and q.quiz_category = $1
    order by q.hot_score desc, q.id desc
    limit $2`,
    [category, clampLimit(limit)]
  )

  return result.rows.map(toQuizCard)
}

/**
 * Quizzes this user started but never finished, most recently played first.
 *
 * Joined through quiz_snapshots rather than player_sessions.quiz_id, because
 * that column is nullable and older rows leave it empty; the snapshot chain is
 * always present. `distinct on (q.id)` keeps one row per quiz and needs q.id
 * first in its ORDER BY, so the whole thing is wrapped to sort by recency.
 *
 * This intentionally does not use PUBLIC_FEED_FILTER: a private quiz the user
 * already played should still be resumable, so visibility is widened to "public
 * or owned by the caller" instead.
 */
export async function getContinuePlaying(
  userId: number,
  limit: number
): Promise<QuizCard[]> {
  const result = await pool.query<QuizCardRow>(
    `select * from (
      select distinct on (q.id)
        ${CARD_COLUMNS},
        ps.created_at as last_played_at
      from player_sessions ps
      join game_sessions gs on gs.id = ps.game_session_id
      join quiz_snapshots qs on qs.id = gs.quiz_snapshot_id
      join quizzes q on q.id = qs.quiz_id
      where ps.player_id = $1
        and ps.deleted_at is null
        and ps.status <> 'finished'
        and q.deleted_at is null
        and q.question_count > 0
        and (q.is_public = true or q.quiz_owner = $1)
      order by q.id, ps.created_at desc
    ) resumable
    order by resumable.last_played_at desc
    limit $2`,
    [userId, clampLimit(limit)]
  )

  return result.rows.map(toQuizCard)
}

/** Active row configuration for the home screen, in display order. */
export async function getActiveHomeSections(): Promise<HomeSectionConfig[]> {
  const result = await pool.query<HomeSectionRow>(
    `select id, section_key, title, section_type, category_name,
      item_limit, position, is_active
    from home_sections
    where is_active = true
    order by position asc, id asc`
  )

  return result.rows.map((row) => ({
    id: row.id,
    section_key: row.section_key,
    title: row.title,
    section_type: row.section_type,
    category_name: row.category_name,
    item_limit: Number(row.item_limit),
    position: Number(row.position),
    is_active: row.is_active
  }))
}
