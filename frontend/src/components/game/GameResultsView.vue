<script setup>
import { computed, ref } from 'vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import LeaderboardList from '@/components/game/LeaderboardList.vue'
import { getGameReview } from '@/api/games.api'
import { toErrorMessage } from '@/api/envelope'
import { useFinalResults } from '@/composables/useFinalResults'
import { readPlayerSession } from '@/composables/usePlayerSession'
import { useGameStore } from '@/stores/game.store'
import { useUiStore } from '@/stores/ui.store'

/**
 * Player end screen.
 *
 * The standings come from `useFinalResults`, so this renders the same whether the player
 * was online when the match ended or opened the room again afterwards.
 *
 * Review is asked for on demand over REST: the answer carries every question the player
 * saw with its options and answer key, which is a document rather than room traffic, and
 * the server refuses it unless the host enabled `flow.reviewMode` and the room is really
 * finished. REST also keeps working once the room is closed, which the socket does not.
 */
const game = useGameStore()
const ui = useUiStore()
const { leaderboard, reviewEnabled, loading, error } = useFinalResults()

const showReview = ref(false)
const requesting = ref(false)

const meId = computed(() => game.playerId)
const myRow = computed(
  () => leaderboard.value.find((row) => String(row.id) === String(meId.value)) ?? null,
)
// An empty board is a setting, not a failure: `showLeaderboard: 'never'` sends [].
const boardHidden = computed(() => !leaderboard.value.length)
const rank = computed(() => myRow.value?.rank ?? null)
const fieldSize = computed(() => leaderboard.value.length)
const eliminated = computed(() => game.player?.status === 'eliminated')

// The row from Postgres wins: it is the flushed score, while the store holds whatever
// the last live event happened to carry.
const score = computed(() => myRow.value?.player_score ?? game.player?.player_score ?? 0)
const correct = computed(
  () => myRow.value?.correct_answers_count ?? game.player?.correct_answers_count ?? null,
)
const total = computed(() => game.review?.total_questions ?? game.totalQuestions ?? null)
// Only known once the review is loaded, and worth showing next to "correct": a low score
// with few answers is a very different match from a low score with every question tried.
const answered = computed(() => game.review?.answered_count ?? null)
const accuracy = computed(() => {
  if (correct.value === null || !total.value) return null
  return Math.round((correct.value / total.value) * 100)
})

// Top three, in podium order (2nd, 1st, 3rd) so the winner stands in the middle.
const podium = computed(() => {
  const top = leaderboard.value.slice(0, 3)
  if (top.length < 3) return []
  return [
    { row: top[1], place: 2 },
    { row: top[0], place: 1 },
    { row: top[2], place: 3 },
  ]
})

const items = computed(() => game.review?.items ?? [])
const reviewLabel = computed(() => {
  if (requesting.value) return 'Loading\u2026'
  if (!items.value.length) return 'Review my answers'
  return showReview.value ? 'Hide review' : 'Show review'
})

const markGlyph = computed(() => {
  if (eliminated.value) return '\u2665'
  return rank.value === 1 ? '\u2605' : '\u2713'
})
const markTone = computed(() => {
  if (eliminated.value) return 'is-out'
  return rank.value === 1 ? 'is-first' : 'is-done'
})
const title = computed(() => {
  if (eliminated.value) return 'Knocked out'
  if (rank.value === 1) return 'You finished first'
  return 'Game over'
})

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

/** The server compares answers as trimmed lowercase strings, so the UI matches that. */
function asKey(value) {
  return String(value ?? '').trim().toLowerCase()
}

function toKeys(value) {
  if (value === null || value === undefined) return new Set()
  const list = Array.isArray(value) ? value : [value]
  return new Set(list.filter((entry) => entry !== null && entry !== undefined && entry !== '').map(asKey))
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
      // a right pick reads as correct and still carries the "Your pick" tag
      state: isCorrect ? 'is-correct' : isPicked ? 'is-wrong' : 'is-muted',
    }
  })
}

// What the player has to look at first: mistakes, then the questions they never got to,
// and the ones already right at the bottom.
const GROUP_ORDER = { 'is-wrong': 0, 'is-skipped': 1, 'is-correct': 2 }

// Options and flags are resolved once per render instead of inside the template, where
// every helper call would run again for each binding.
const reviewRows = computed(() =>
  items.value
    .map((item) => {
      const unanswered = isUnanswered(item)
      return {
        ...item,
        key: `${item.question_index}:${item.question_id ?? ''}`,
        options: optionsOf(item),
        unanswered,
        state: unanswered ? 'is-skipped' : item.is_correct ? 'is-correct' : 'is-wrong',
      }
    })
    // the badge keeps the real question number, so inside a group the played order stays
    .sort(
      (a, b) =>
        GROUP_ORDER[a.state] - GROUP_ORDER[b.state] || a.question_index - b.question_index,
    ),
)

/**
 * One request, one answer: the old socket call had no ack, so it had to guess with a
 * timeout and read a refusal off the shared error channel. The socket token proves this
 * tab is that player, exactly like it does on the `/game` namespace.
 */
async function openReview() {
  if (items.value.length) {
    showReview.value = !showReview.value
    return
  }

  const token = readPlayerSession()?.socketToken
  if (!game.sessionId || !token) {
    ui.toast('This browser no longer holds a seat in that room.', 'error')
    return
  }

  requesting.value = true
  const data = await getGameReview(game.sessionId, token).catch((err) => {
    ui.toast(toErrorMessage(err, 'Review is not available for this room.'), 'error')
    return null
  })
  requesting.value = false
  if (!data) return

  game.applyReview(data)
  showReview.value = true
}
</script>

<template>
  <section class="grid gap-lg">
    <!-- Outcome. One number the player came for, everything else is secondary. -->
    <div class="card-surface hero p-xl text-center">
      <p class="eyebrow-label">
        Final results
      </p>
      <div class="final-mark" :class="markTone">
        {{ markGlyph }}
      </div>
      <h2 class="mt-sm text-heading-2 text-ink">
        {{ title }}
      </h2>
      <p v-if="rank" class="mt-xxs text-body-sm text-ink-2">
        Rank <span class="num">{{ rank }}</span> of <span class="num">{{ fieldSize }}</span>
      </p>
      <p v-else-if="boardHidden" class="mt-xxs text-body-sm text-ink-2">
        The host keeps the standings private for this room.
      </p>

      <div class="stat-row">
        <div class="stat">
          <p class="stat-value num">
            {{ score }}
          </p>
          <p class="stat-label">
            Score
          </p>
        </div>
        <div v-if="correct !== null" class="stat">
          <p class="stat-value num">
            {{ correct }}<span v-if="total" class="stat-total">/{{ total }}</span>
          </p>
          <p class="stat-label">
            Correct
          </p>
        </div>
        <div v-if="answered !== null" class="stat">
          <p class="stat-value num">
            {{ answered }}<span v-if="total" class="stat-total">/{{ total }}</span>
          </p>
          <p class="stat-label">
            Answered
          </p>
        </div>
        <div v-if="accuracy !== null" class="stat">
          <p class="stat-value num">
            {{ accuracy }}%
          </p>
          <p class="stat-label">
            Accuracy
          </p>
        </div>
      </div>
    </div>

    <div v-if="loading && !leaderboard.length" class="card-surface flex items-center gap-xs p-lg">
      <BaseSpinner />
      <span class="text-body-sm text-ink-2">Loading the results&hellip;</span>
    </div>
    <p v-else-if="error" class="card-surface p-lg text-body-sm text-ans-a">
      {{ error }}
    </p>

    <section v-if="leaderboard.length" class="card-surface p-lg">
      <p class="section-title">
        Standings
      </p>

      <!-- The three names everyone looks for first, before the full list. -->
      <ol v-if="podium.length" class="podium">
        <li
          v-for="spot in podium"
          :key="spot.place"
          class="podium-spot"
          :class="[`is-${spot.place}`, { 'is-me': String(spot.row.id) === String(meId) }]"
        >
          <span class="podium-place num">{{ spot.place }}</span>
          <span class="podium-name" :title="spot.row.player_name">{{ spot.row.player_name }}</span>
          <span class="podium-score num">{{ spot.row.player_score }}</span>
          <span class="podium-block" />
        </li>
      </ol>
      <LeaderboardList class="mt-sm" :rows="leaderboard" :me-id="meId" detailed />
    </section>

    <!-- Review is per room and per player: only your own answers ever come back. -->
    <section v-if="reviewEnabled" class="card-surface p-lg">
      <div class="flex flex-wrap items-center justify-between gap-sm">
        <div class="min-w-0">
          <p class="section-title">
            Review
          </p>
          <p class="mt-xxs text-caption text-ink-3">
            Every question of the quiz, wrong ones first, then the ones you skipped.
          </p>
        </div>
        <button class="btn-utility" type="button" :disabled="requesting" @click="openReview">
          {{ reviewLabel }}
        </button>
      </div>

      <ul v-if="showReview && reviewRows.length" class="mt-lg grid gap-sm">
        <li
          v-for="row in reviewRows"
          :key="row.key"
          class="review-item"
          :class="row.state"
        >
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
              <li
                v-for="option in row.options"
                :key="option.key"
                class="review-option"
                :class="option.state"
              >
                <span class="review-option-letter num">{{ option.letter }}</span>
                <span class="review-option-text">{{ option.text }}</span>
                <span v-if="option.isPicked" class="review-tag">Your pick</span>
                <span v-if="option.isCorrect" class="review-tag is-right">Correct</span>
              </li>
            </ul>

            <!-- Written answers have no options, so the raw values are all there is. -->
            <template v-else>
              <p class="mt-xs text-caption text-ink-2">
                Your answer:
                <span class="review-answer">{{ answerText(row.your_answer) }}</span>
              </p>
              <p v-if="row.correct_answer !== null" class="mt-xxs text-caption text-ink-2">
                Correct answer:
                <span class="review-answer is-right">{{ answerText(row.correct_answer) }}</span>
              </p>
            </template>

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
      <p v-else-if="showReview" class="mt-md text-body-sm text-ink-2">
        No questions came back for this match.
      </p>
    </section>

    <div class="flex flex-wrap items-center justify-center gap-xs">
      <RouterLink class="btn-primary" :to="{ name: 'join-game' }">
        Join another game
      </RouterLink>
      <RouterLink class="btn-ghost" to="/">
        Back home
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.final-mark {
  width: 64px;
  height: 64px;
  margin: var(--space-md, 16px) auto 0;
  display: grid;
  place-items: center;
  border-radius: var(--r-full);
  font-size: 30px;
  line-height: 1;
}

.final-mark.is-first {
  background: var(--ans-c-soft);
  color: var(--ans-c);
}

.final-mark.is-done {
  background: var(--spotlight-soft);
  color: var(--spotlight);
}

.final-mark.is-out {
  background: var(--ans-a-soft);
  color: var(--ans-a);
}

.stat-row {
  margin-top: 22px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.stat {
  min-width: 110px;
  flex: 1 1 110px;
  max-width: 180px;
  padding: 12px 10px;
  border-radius: var(--r-lg);
  background: var(--canvas);
  border: 1px solid var(--hairline);
}

.stat-value {
  font-size: 26px;
  line-height: 1.1;
  color: var(--ink);
}

.stat-total {
  font-size: 15px;
  color: var(--ink-3);
}

.stat-label {
  margin-top: 2px;
  font-size: 12px;
  color: var(--ink-3);
}

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

.review-answer {
  color: var(--ink);
  font-weight: 500;
}

.review-answer.is-right {
  color: var(--ans-d);
}

.review-item.is-skipped {
  border-left-color: var(--hairline);
}

.review-flag {
  margin-top: 8px;
  font-size: 12px;
  color: var(--ink-3);
}

.review-options {
  margin-top: 10px;
  display: grid;
  gap: 6px;
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

.review-tag {
  flex: none;
  padding: 1px 7px;
  border-radius: var(--r-full);
  background: var(--paper);
  border: 1px solid var(--hairline);
  font-size: 11px;
  color: var(--ink-2);
}

.review-tag.is-right {
  border-color: var(--ans-d);
  color: var(--ans-d);
}

.review-score {
  flex: none;
  text-align: right;
}

.hero {
  background:
    radial-gradient(120% 140% at 50% -20%, var(--spotlight-soft) 0%, transparent 60%),
    var(--paper);
}

.podium {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: end;
  gap: 10px;
  margin-top: 16px;
}

.podium-spot {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 10px 6px 0;
  border-radius: var(--r-lg);
  text-align: center;
}

.podium-spot.is-me {
  background: var(--spotlight-soft);
}

.podium-place {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: var(--r-full);
  background: var(--canvas);
  color: var(--ink-2);
  font-size: 13px;
}

.podium-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
}

.podium-score {
  font-size: 13px;
  color: var(--ink-2);
}

.podium-block {
  width: 100%;
  margin-top: 6px;
  border-radius: var(--r-md) var(--r-md) 0 0;
  background: var(--wash);
}

.podium-spot.is-1 .podium-block {
  height: 74px;
  background: var(--ans-c-soft);
}

.podium-spot.is-2 .podium-block {
  height: 54px;
}

.podium-spot.is-3 .podium-block {
  height: 38px;
}

.podium-spot.is-1 .podium-place {
  background: var(--ans-c-soft);
  color: var(--ans-c);
}
</style>
