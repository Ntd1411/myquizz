import { makeQuizMeta, toDraft } from '@/utils/quizImport'

/**
 * One-shot handoff between the "choose a creation method" page and the quiz
 * editor. A module-level value would be lost on a hard refresh, so the draft is
 * mirrored in sessionStorage and consumed exactly once.
 */
const STORAGE_KEY = 'myquizz:pending-quiz-draft'

let pending = null

/** Stores a converted draft, then the editor page picks it up on mount. */
export function setPendingDraft({ quiz, questions, source = 'import' }) {
  pending = { quiz: { ...makeQuizMeta(), ...(quiz ?? {}) }, questions: questions ?? [], source }
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        quiz: pending.quiz,
        source,
        // Only the serialisable part of a draft is persisted; ids and transient
        // upload flags are rebuilt by toDraft on read.
        questions: pending.questions.map((question) => ({
          question_type: question.question_type,
          question_text: question.question_text,
          time_limit: question.time_limit,
          question_image: question.question_image,
          answer_options: question.answer_options.filter(Boolean),
          correct_answer:
            question.question_type === 'multiple_choice' ||
            question.question_type === 'multiple_select'
              ? question.correctIndexes
              : question.correctText,
        })),
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
