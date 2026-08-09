/**
 * Maps backend quiz rows to the shape the UI components expect.
 *
 * Listing endpoints return snake_case columns (QuizSummary / QuizCard):
 *   { id, quiz_owner, quiz_name, quiz_description, quiz_image, quiz_category,
 *     quiz_language, is_public?, question_count, play_count, completion_rate,
 *     created_at, updated_at? }
 * QuizCard rows (home / feed) omit `is_public` and `updated_at` on purpose.
 *
 * The card components were built against the camelCase mock shape, so every quiz row
 * goes through this mapper before it reaches a component. Keeping the translation in
 * one place means a column rename only has to be handled here.
 */
export function toQuizCard(row) {
  if (!row) return null

  return {
    id: row.id,
    title: row.quiz_name ?? '',
    description: row.quiz_description ?? '',
    category: row.quiz_category ?? '',
    language: row.quiz_language ?? '',
    imageUrl: row.quiz_image ?? null,
    questionCount: Number(row.question_count) || 0,
    playCount: Number(row.play_count) || 0,
    // completion_rate is null for a quiz nobody has finished yet, which is not the
    // same thing as 0.
    completionRate:
      row.completion_rate === null || row.completion_rate === undefined
        ? null
        : Number(row.completion_rate),
    // Only /quizzes/search and /quizzes/me expose visibility; home and feed do not.
    isPublic: row.is_public === undefined ? null : row.is_public,
    ownerId: row.quiz_owner ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

/** Maps a list of rows, dropping anything unexpected. */
export function toQuizCards(rows) {
  return Array.isArray(rows) ? rows.map(toQuizCard).filter(Boolean) : []
}

/**
 * Maps one home section. The key, title and type stay server driven so the page
 * never hardcodes a row.
 */
export function toHomeSection(section) {
  return {
    key: section.section_key,
    title: section.title,
    type: section.section_type,
    items: toQuizCards(section.items),
  }
}
