import { makeQuizMeta, toDraft } from '@/utils/quizImport'

/**
 * One-shot handoff between the "choose a creation method" page and the quiz
 * editor. A module-level value would be lost on a hard refresh, so the draft is
 * mirrored in sessionStorage and consumed exactly once.
 */
const STORAGE_KEY = 'myquizz:pending-quiz-draft'

let pending = null

/**
 * Keeps only what survives a JSON round trip. Draft ids and the transient upload
 * flags are rebuilt by toDraft on read, and empty option slots are kept on
 * purpose so a half-typed question comes back exactly as it was left.
 */
function serialiseQuestions(questions) {
  return questions.map((question) => ({
    question_type: question.question_type,
    question_text: question.question_text,
    time_limit: question.time_limit,
    question_image: question.question_image,
    answer_options: question.answer_options,
    correct_answer:
      question.question_type === 'multiple_choice' ||
      question.question_type === 'multiple_select'
        ? question.correctIndexes
        : question.correctText,
  }))
}

/** Stores a converted draft, then the editor page picks it up on mount. */
export function setPendingDraft({ quiz, questions, source = 'import' }) {
  pending = { quiz: { ...makeQuizMeta(), ...(quiz ?? {}) }, questions: questions ?? [], source }
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        quiz: pending.quiz,
        source,
        questions: serialiseQuestions(pending.questions),
      }),
    )
  } catch {
    // Private mode or a full storage quota: the in-memory copy still works.
  }
}

/** Reads and clears the pending draft. Returns null when there is none. */
export function takePendingDraft() {
  if (pending) {
    const draft = pending
    clearPendingDraft()
    return draft
  }

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    clearPendingDraft()
    return {
      quiz: { ...makeQuizMeta(), ...(parsed.quiz ?? {}) },
      questions: (parsed.questions ?? []).map(toDraft),
      source: parsed.source ?? 'import',
    }
  } catch {
    clearPendingDraft()
    return null
  }
}

export function clearPendingDraft() {
  pending = null
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}

/*
 * Autosave for the editor itself, which is a different problem from the handoff
 * above: it must survive a closed tab, so it lives in localStorage, and a new
 * quiz and every edited quiz get their own key so opening a second editor never
 * overwrites the first draft.
 */
const AUTOSAVE_PREFIX = 'myquizz:quiz-draft:'
const AUTOSAVE_MAX_AGE = 7 * 24 * 60 * 60 * 1000

/** 'create' for a new quiz, 'edit:<id>' for an existing one. */
export function draftKey(quizId) {
  return quizId ? `edit:${quizId}` : 'create'
}

export function saveAutoDraft(key, { quiz, questions }) {
  try {
    localStorage.setItem(
      AUTOSAVE_PREFIX + key,
      JSON.stringify({
        savedAt: Date.now(),
        quiz,
        questions: serialiseQuestions(questions ?? []),
      }),
    )
  } catch {
    // Storage full or blocked: autosave is a convenience, never a blocker.
  }
}

/** Returns { quiz, questions, savedAt }, or null when there is nothing usable. */
export function readAutoDraft(key) {
  let parsed = null

  try {
    const raw = localStorage.getItem(AUTOSAVE_PREFIX + key)
    if (!raw) return null
    parsed = JSON.parse(raw)
  } catch {
    clearAutoDraft(key)
    return null
  }

  // A stale draft is more likely to confuse than to help.
  if (!parsed?.savedAt || Date.now() - parsed.savedAt > AUTOSAVE_MAX_AGE) {
    clearAutoDraft(key)
    return null
  }

  return {
    quiz: { ...makeQuizMeta(), ...(parsed.quiz ?? {}) },
    questions: (parsed.questions ?? []).map(toDraft),
    savedAt: parsed.savedAt,
  }
}

export function clearAutoDraft(key) {
  try {
    localStorage.removeItem(AUTOSAVE_PREFIX + key)
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}
