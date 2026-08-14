/**
 * Types shared by the quiz listing endpoints: search, public profile and
 * /quizzes/me.
 *
 * Sorts are declared as a runtime list plus a derived union so the cursor codec,
 * the request schemas and the repository all agree on the exact same strings.
 * Each endpoint accepts a different subset; those subsets live with the request
 * schemas, not here.
 */

import type { QuizOwner } from './home.type.js'

// Every sort the listing feature understands, across all three endpoints.
export const LIST_SORTS = [
  'relevance',
  'newest',
  'oldest',
  'name_asc',
  'name_desc',
  'most_played',
  'trending',
  'recently_updated'
] as const

export type ListSort = (typeof LIST_SORTS)[number]

/**
 * The data kind of each sort's primary ORDER BY value.
 *
 * The cursor codec uses this to validate an incoming cursor's primary value, and
 * the listing repository uses it to cast that value to the matching Postgres
 * type. Keeping it next to LIST_SORTS makes it impossible to add a sort without
 * deciding how its cursor is compared.
 */
export const SORT_PRIMARY_KIND: Record<ListSort, 'number' | 'timestamp' | 'text'> = {
  relevance: 'number',
  newest: 'timestamp',
  oldest: 'timestamp',
  name_asc: 'text',
  name_desc: 'text',
  most_played: 'number',
  trending: 'number',
  recently_updated: 'timestamp'
}

// Visibility filter accepted by GET /quizzes/me.
export const VISIBILITY_FILTERS = ['all', 'public', 'private'] as const

export type VisibilityFilter = (typeof VISIBILITY_FILTERS)[number]

/**
 * A quiz row as returned by every listing endpoint.
 *
 * Superset of QuizCard (home/feed): it adds is_public and updated_at because
 * /quizzes/me must show owners the visibility and last edit of their own
 * quizzes. hot_score, scored_at and deleted_at are never exposed here; they are
 * internal ranking and lifecycle details.
 */
export interface QuizSummary {
  id: number;
  quiz_owner: number;
  owner: QuizOwner | null;
  quiz_name: string;
  quiz_description: string | null;
  quiz_image: string | null;
  quiz_category: string | null;
  quiz_language: string;
  is_public: boolean;
  question_count: number;
  play_count: number;
  completion_rate: number;
  created_at: string;
  updated_at: string;
}

/**
 * One page of a cursor-paginated listing.
 *
 * nextCursor is null on the last page. total is only present when the caller
 * opted in with include_total, because counting is a second query the default
 * path deliberately avoids.
 */
export interface ListPage {
  items: QuizSummary[];
  nextCursor: string | null;
  hasMore: boolean;
  total?: number;
}
