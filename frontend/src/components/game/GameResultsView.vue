<script setup>
import { computed, ref } from 'vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import LeaderboardList from '@/components/game/LeaderboardList.vue'
import { useFinalResults } from '@/composables/useFinalResults'
import { useGameSocket } from '@/composables/useGameSocket'
import { useGameStore } from '@/stores/game.store'
import { useUiStore } from '@/stores/ui.store'

/**
 * Player end screen.
 *
 * The standings come from `useFinalResults`, so this renders the same whether the player
 * was online when the match ended or opened the room again afterwards.
 *
 * Review is asked for on demand: the answer carries every question the player saw, which
 * is far too heavy to push to a whole room, and the server refuses it unless the host
 * enabled `flow.reviewMode` and the session is really finished.
 */
const game = useGameStore()
const socket = useGameSocket()
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
const accuracy = computed(() => {
  if (correct.value === null || !total.value) return null
  return Math.round((correct.value / total.value) * 100)
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

function answerText(value) {
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'No answer'
  if (value === null || value === undefined || value === '') return 'No answer'
  return String(value)
}

/**
 * `game:review` has no ack, and a refusal comes back on the shared error channel, so the
 * old failure has to be cleared first or it would be reported as this one.
 */
function openReview() {
  if (items.value.length) {
    showReview.value = !showReview.value
    return
  }

  requesting.value = true
  game.setError(null)
  socket.requestReview()
  window.setTimeout(() => {
    requesting.value = false
    if (game.review) {
      showReview.value = true
      return
    }
    ui.toast(game.lastError?.message ?? 'Review is not available for this room.', 'error')
  }, 700)
}
</script>

<template>
  <section class="grid gap-lg">
    <!-- Outcome. One number the player came for, everything else is secondary. -->
    <div class="card-surface p-xl text-center">
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
            Every question you answered, with the correct answer.
          </p>
        </div>
        <button class="btn-utility" type="button" :disabled="requesting" @click="openReview">
          {{ reviewLabel }}
        </button>
      </div>

      <ul v-if="showReview && items.length" class="mt-lg grid gap-sm">
        <li
          v-for="item in items"
          :key="item.question_index"
          class="review-item"
          :class="item.is_correct ? 'is-correct' : 'is-wrong'"
        >
          <span class="review-index num">{{ item.question_index + 1 }}</span>
          <div class="min-w-0 flex-1">
            <p class="text-body-sm text-ink">
              {{ item.question_text || 'This question is no longer available.' }}
            </p>
            <img v-if="item.question_image" class="review-image" :src="item.question_image" alt="">
            <p class="mt-xs text-caption text-ink-2">
              Your answer:
              <span class="review-answer">{{ answerText(item.your_answer) }}</span>
            </p>
            <p v-if="!item.is_correct && item.correct_answer !== null" class="mt-xxs text-caption text-ink-2">
              Correct answer:
              <span class="review-answer is-right">{{ answerText(item.correct_answer) }}</span>
            </p>
            <p v-if="item.explanation" class="mt-xs text-caption text-ink-3">
              {{ item.explanation }}
            </p>
          </div>
          <div class="review-score">
            <p class="num text-body-sm" :class="item.is_correct ? 'text-ans-d' : 'text-ink-3'">
              {{ item.score_earned ? `+${item.score_earned}` : '0' }}
            </p>
            <p v-if="item.is_late" class="text-caption text-ink-3">
              Late
            </p>
          </div>
        </li>
      </ul>
      <p v-else-if="showReview" class="mt-md text-body-sm text-ink-2">
        No answers were recorded for you in this match.
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

.review-score {
  flex: none;
  text-align: right;
}
</style>
