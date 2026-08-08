import type { QuizSummary } from './listing.type.js'

/**
 * The database row shape toQuizSummary consumes.
 *
 * created_at and updated_at may arrive as Date (node-postgres for timestamptz)
 * or as string (when a query formats them via to_char), so both are accepted
 * and normalized to an ISO string below. Numeric counters can arrive as strings
 * from pg aggregates, so they are coerced too. hot_score, scored_at and
 * deleted_at are intentionally absent: exposing hot_score would let clients
 * depend on the ranking formula, and the other two are internal lifecycle
 * columns.
 */
export interface QuizSummaryRow {
  id: number;
  quiz_owner: number;
  quiz_name: string;
  quiz_description: string | null;
  quiz_image: string | null;
  quiz_category: string | null;
  quiz_language: string;
  is_public: boolean;
  question_count: number | string;
  play_count: number | string;
  completion_rate: number | string;
  created_at: Date | string;
  updated_at: Date | string;
}

/**
 * The single place a listing row becomes a client-facing summary. Every listing
 * endpoint maps through here, so the response shape changes in exactly one file.
 */
export function toQuizSummary(row: QuizSummaryRow): QuizSummary {
  return {
    id: row.id,
    quiz_owner: row.quiz_owner,
    quiz_name: row.quiz_name,
    quiz_description: row.quiz_description,
    quiz_image: row.quiz_image,
    quiz_category: row.quiz_category,
    quiz_language: row.quiz_language,
    is_public: row.is_public,
    question_count: Number(row.question_count),
    play_count: Number(row.play_count),
    completion_rate: Number(row.completion_rate),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at)
  }
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}
