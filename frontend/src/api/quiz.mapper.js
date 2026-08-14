/**
 * Maps backend quiz rows to the shape the UI components expect.
 *
 * Listing endpoints return snake_case columns (QuizSummary / QuizCard):
 *   { id, quiz_owner, owner, quiz_name, quiz_description, quiz_image,
 *     quiz_category, quiz_language, is_public?, question_count, play_count,
 *     completion_rate, created_at, updated_at? }
 * QuizCard rows (home / feed) omit `is_public` and `updated_at` on purpose.
 *
 * The card components speak camelCase, so every quiz row goes through this mapper
 * before it reaches a component. Keeping the translation in one place means a column
 * rename only has to be handled here.
 */
/**
 * The author block every listing joins in. Null when the backend could not
 * resolve the author (deleted account), which the card renders as a neutral
 * placeholder rather than an empty name.
 */
function toOwner(owner) {
  if (!owner) return null

  return {
    id: owner.id ?? null,
    fullname: owner.fullname ?? '',
    avatar: owner.avatar ?? null,
  }
}

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
    owner: toOwner(row.owner),
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

/**
 * GET /quizzes/id/:quizId returns the quiz row itself, not a card: snake_case
 * columns plus a nested `questions` array. It is a different shape from the
 * listing rows above, so it gets its own mapper instead of reusing toQuizCard.
 */

/**
 * Reads one answer option whatever shape the backend stored.
 *
 * The create path has always written { id, option_text } objects while the
 * update path used to store the raw strings, so rows written before that was
 * unified can still hold either form. Both are accepted here so an old quiz
 * never renders as [object Object].
 */
export function readOptionText(option) {
  if (option === null || option === undefined) return ''
  if (typeof option === 'string') return option
  return option.option_text ?? option.text ?? ''
}

/**
 * answer_options and correct_answer are written with JSON.stringify. A jsonb
 * column hands the value back already parsed while a text column hands back the
 * JSON source, so the string form is decoded once here instead of at every call
 * site.
 */
function parseStoredJson(value) {
  if (typeof value !== 'string') return value

  const trimmed = value.trim()
  // A free-text answer is stored as a plain string and must be returned as is.
  if (!trimmed.startsWith('[') && !trimmed.startsWith('"')) return value

  try {
    return JSON.parse(trimmed)
  } catch {
    // Not JSON after all, just an answer that happens to start with a bracket.
    return value
  }
}

function toOption(option, index) {
  const id =
    option !== null && typeof option === 'object' && option.id !== undefined
      ? option.id
      : index

  // `index` is what correct_answer points at: the stored option ids are the
  // positions the backend assigned at insert time.
  return { id, index, text: readOptionText(option) }
}

function toOptions(value) {
  const parsed = parseStoredJson(value)
  return Array.isArray(parsed) ? parsed.map(toOption) : []
}

/**
 * correct_answer is either an array of option indexes (choice questions) or a
 * free-text string (short / long answer). Both are exposed as separate fields so
 * a component never has to type-check the value.
 */
function toCorrectAnswer(value) {
  const parsed = parseStoredJson(value)

  if (Array.isArray(parsed)) {
    return { indexes: parsed.map(Number).filter(Number.isInteger), text: '' }
  }

  if (typeof parsed === 'number') {
    return { indexes: [parsed], text: '' }
  }

  return { indexes: [], text: typeof parsed === 'string' ? parsed : '' }
}

function toQuestion(row, index) {
  const correct = toCorrectAnswer(row.correct_answer)

  return {
    id: row.id ?? index,
    index,
    type: row.question_type ?? 'multiple_choice',
    text: row.question_text ?? '',
    imageUrl: row.question_image ?? null,
    // Optional authoring fields. Empty strings rather than null so a template can
    // test them the same way as any other text field.
    hint: row.question_hint ?? '',
    explanation: row.explanation ?? '',
    timeLimit: Number(row.time_limit) || 0,
    options: toOptions(row.answer_options),
    correctIndexes: correct.indexes,
    correctText: correct.text,
  }
}

/** Maps the quiz detail row, including its questions, to the camelCase UI shape. */
export function toQuizDetail(row) {
  if (!row) return null

  const questions = Array.isArray(row.questions) ? row.questions.map(toQuestion) : []

  return {
    id: row.id,
    title: row.quiz_name ?? '',
    description: row.quiz_description ?? '',
    category: row.quiz_category ?? '',
    language: row.quiz_language ?? '',
    imageUrl: row.quiz_image ?? null,
    isPublic: row.is_public === undefined ? null : row.is_public,
    ownerId: row.quiz_owner ?? null,
    owner: toOwner(row.owner),
    // question_count is a counter on the quizzes table; fall back to the list
    // itself so the page still shows a number if the counter is missing.
    questionCount: Number(row.question_count) || questions.length,
    playCount: Number(row.play_count) || 0,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    questions,
  }
}
