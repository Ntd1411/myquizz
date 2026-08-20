<script setup>
import { computed } from 'vue'

/**
 * One player's answers, question by question: what they picked, what was right, what it
 * scored.
 *
 * This used to live inside GameResultsView. The preview screen ends on exactly the same
 * question-by-question breakdown, and two copies of "which option was correct" would be
 * two chances to disagree with the server, so the list moved out into one component.
 *
 * The rows are the items GET /games/:id/review answers with, and the preview builds the
 * same shape locally (see composables/usePreviewGame.js). Nothing here fetches: the
 * caller owns the request.
 */
const props = defineProps({
  /** Review items: question_index, question_text, answer_options, your_answer, ... */
  items: { type: Array, default: () => [] },
  /**
   * 'review' puts the mistakes first, which is what a player wants after a match.
   * 'play' keeps the order the questions were answered in.
   */
  order: {
    type: String,
    default: 'review',
    validator: (value) => ['review', 'play'].includes(value),
  },
})

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

// What the player has to look at first: mistakes, then the questions they never got to,
// and the ones already right at the bottom.
const GROUP_ORDER = { 'is-wrong': 0, 'is-skipped': 1, 'is-correct': 2 }

/** The server compares answers as trimmed lowercase strings, so the UI matches that. */
function asKey(value) {
  return String(value ?? '').trim().toLowerCase()
}

function toKeys(value) {
  if (value === null || value === undefined) return new Set()
  const list = Array.isArray(value) ? value : [value]
  return new Set(
    list.filter((entry) => entry !== null && entry !== undefined && entry !== '').map(asKey),
  )
}

/** The server sends `time_taken` in seconds, rounded to two decimals. */
function formatSeconds(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  return value >= 10 ? `${Math.round(value)}s` : `${Math.round(value * 10) / 10}s`
}

function answerText(value) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'No answer'
  if (value === null || value === undefined || value === '') return 'No answer'
  return String(value)
}

// The server sends `answered: false` for a question the player never submitted. Older
// payloads have no flag, so an empty answer is the fallback signal.
function isUnanswered(item) {
  if (typeof item.answered === 'boolean') return !item.answered
  const value = item.your_answer
  if (Array.isArray(value)) return !value.length
  return value === null || value === undefined || value === ''
}

/**
 * Every option of the question, tagged with what the player picked and what was right.
 * Snapshots store options either as [{ id, option_text }] or as plain strings, so both
 * shapes have to read back here, exactly like QuestionStage does in the game.
 */
function optionsOf(item) {
  const picked = toKeys(item.your_answer)
  const right = toKeys(item.correct_answer)
  return (item.answer_options ?? []).map((option, position) => {
    const isRow = option !== null && typeof option === 'object'
    const value = isRow ? option.id ?? position : option
    const key = asKey(value)
    const isCorrect = right.has(key)
    const isPicked = picked.has(key)
    return {
      key: `${position}:${String(value)}`,
      text: isRow ? option.option_text ?? '' : String(option),
      letter: LETTERS[position] ?? String(position + 1),
      isCorrect,
      isPicked,
      // a right pick reads as correct and still carries the "Your answer" tag
      state: isCorrect ? 'is-correct' : isPicked ? 'is-wrong' : 'is-muted',
    }
  })
}

// Options and flags are resolved once per render instead of inside the template, where
// every helper call would run again for each binding.
const rows = computed(() => {
  const mapped = props.items.map((item) => {
    const unanswered = isUnanswered(item)
    return {
      ...item,
      key: `${item.question_index}:${item.question_id ?? ''}`,
      options: optionsOf(item),
      unanswered,
      state: unanswered ? 'is-skipped' : item.is_correct ? 'is-correct' : 'is-wrong',
    }
  })

  if (props.order === 'play') return mapped

  // the badge keeps the real question number, so inside a group the played order stays
  return mapped.sort(
    (a, b) => GROUP_ORDER[a.state] - GROUP_ORDER[b.state] || a.question_index - b.question_index,
  )
})
</script>

<template>
  <ul class="grid gap-sm">
    <li v-for="row in rows" :key="row.key" class="review-item" :class="row.state">
      <span class="review-index num">{{ row.question_index + 1 }}</span>
      <div class="min-w-0 flex-1">
        <p class="text-body-sm text-ink">
          {{ row.question_text || 'This question is no longer available.' }}
        </p>
        <img v-if="row.question_image" class="review-image" :src="row.question_image" alt="">

        <p v-if="row.unanswered" class="review-flag">
          You did not answer this question.
        </p>

        <!-- Every option, so a wrong pick is read right next to the correct one. -->
        <ul v-if="row.options.length" class="review-options">
          <li v-for="option in row.options" :key="option.key" class="review-option-slot">
            <!--
              The tag hangs above the box and out of the flow, so the distance between two
              options is the same whether an option carries a tag or not.
            -->
            <span
              v-if="option.isPicked"
              class="review-option-tag"
              :class="option.isCorrect ? 'is-right' : 'is-off'"
            >
              Your answer
            </span>
            <div class="review-option" :class="option.state">
              <span class="review-option-letter num">{{ option.letter }}</span>
              <span class="review-option-text">{{ option.text }}</span>
              <span v-if="option.isCorrect" class="review-option-note">Correct</span>
            </div>
          </li>
        </ul>

        <!--
          Written answers have no options, so the typed value is put in the same box an
          option would use: one border language for every question type.
        -->
        <div v-else class="review-written">
          <div class="review-option-slot">
            <span
              class="review-option-tag"
              :class="row.state === 'is-correct' ? 'is-right' : 'is-off'"
            >
              Your answer
            </span>
            <div
              class="review-option"
              :class="row.state === 'is-correct' ? 'is-correct' : 'is-wrong'"
            >
              <span class="review-option-text">{{ answerText(row.your_answer) }}</span>
            </div>
          </div>
          <!-- The key is only worth repeating when the player did not already write it. -->
          <div
            v-if="row.correct_answer !== null && row.state !== 'is-correct'"
            class="review-option-slot"
          >
            <span class="review-option-tag is-right">
              Correct answer
            </span>
            <div class="review-option is-correct">
              <span class="review-option-text">{{ answerText(row.correct_answer) }}</span>
            </div>
          </div>
        </div>

        <p v-if="row.explanation" class="mt-xs text-caption text-ink-3">
          {{ row.explanation }}
        </p>
      </div>
      <div class="review-score">
        <p class="num text-body-sm" :class="row.is_correct ? 'text-ans-d' : 'text-ink-3'">
          {{ row.score_earned ? `+${row.score_earned}` : '0' }}
        </p>
        <p v-if="!row.unanswered && row.time_taken !== null" class="num text-caption text-ink-3">
          {{ formatSeconds(row.time_taken) }}
        </p>
        <p v-if="row.is_late && !row.unanswered" class="text-caption text-ink-3">
          Late
        </p>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.review-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border-radius: var(--r-lg);
  border: 1px solid var(--hairline);
  background: var(--paper);
  border-left-width: 3px;
}

.review-item.is-correct {
  border-left-color: var(--ans-d);
}

.review-item.is-wrong {
  border-left-color: var(--ans-a);
}

/* A question left unanswered is a lost question, so it reads red like a wrong one. */
.review-item.is-skipped {
  border-left-color: var(--ans-a);
}

.review-index {
  width: 26px;
  height: 26px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--r-full);
  background: var(--canvas);
  color: var(--ink-2);
  font-size: 13px;
}

.review-image {
  margin-top: 8px;
  max-height: 120px;
  border-radius: var(--r-md);
}

.review-flag {
  margin-top: 8px;
  font-size: 12px;
  color: var(--ink-3);
}

.review-options {
  /* room for the tag that hangs above the first option box */
  margin-top: 24px;
  display: grid;
  gap: 20px;
}

.review-option-slot {
  position: relative;
}

.review-option-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--ink-3);
}

.review-option-slot .review-option-tag {
  position: absolute;
  top: -15px;
  left: 10px;
}

.review-option-tag.is-right {
  color: var(--ans-d);
}

.review-option-tag.is-off {
  color: var(--ans-a);
}

.review-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: var(--r-md);
  border: 1px solid var(--hairline);
  background: var(--canvas);
  font-size: 13px;
  color: var(--ink-2);
}

.review-option.is-correct {
  border-color: var(--ans-d);
  background: var(--ans-d-soft);
  color: var(--ink);
}

.review-option.is-wrong {
  border-color: var(--ans-a);
  background: var(--ans-a-soft);
  color: var(--ink);
}

.review-option-letter {
  width: 20px;
  height: 20px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: var(--r-full);
  background: var(--paper);
  font-size: 11px;
  color: var(--ink-2);
}

.review-option-text {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
}

.review-option-note {
  flex: none;
  font-size: 11px;
  font-weight: 600;
  color: var(--ans-d);
}

/* Same rhythm as the option list, tags included. */
.review-written {
  margin-top: 24px;
  display: grid;
  gap: 20px;
}

.review-score {
  flex: none;
  text-align: right;
}
</style>
