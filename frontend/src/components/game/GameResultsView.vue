<script setup>
import { computed, ref } from 'vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import AnswerReviewList from '@/components/game/AnswerReviewList.vue'
import LeaderboardList from '@/components/game/LeaderboardList.vue'
import { getGameReview } from '@/api/games.api'
import { toErrorMessage } from '@/api/envelope'
import { useFinalResults } from '@/composables/useFinalResults'
import { readPlayerSession } from '@/composables/usePlayerSession'
import { useGameStore } from '@/stores/game.store'

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
const { leaderboard, reviewEnabled, loading, error } = useFinalResults()

const showReview = ref(false)
const requesting = ref(false)

// Why the review could not be opened, said on the screen that asked for it.
const reviewError = ref('')

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

  reviewError.value = ''

  const token = readPlayerSession()?.socketToken
  if (!game.sessionId || !token) {
    reviewError.value = 'This browser no longer holds a seat in that room.'
    return
  }

  requesting.value = true
  const data = await getGameReview(game.sessionId, token).catch((err) => {
    reviewError.value = toErrorMessage(err, 'Review is not available for this room.')
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
    <p v-if="reviewError" class="review-error" role="alert">
      <span v-text="reviewError" />
    </p>

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

      <!-- The same list the preview screen ends on: see AnswerReviewList.vue. -->
      <AnswerReviewList
        v-if="showReview && items.length"
        class="mt-lg"
        :items="items"
      />
      <p v-else-if="showReview" class="mt-md text-body-sm text-ink-2">
        No questions came back for this match.
      </p>
    </section>

    <div class="flex flex-wrap items-center justify-center gap-xs">
      <RouterLink class="btn-primary" :to="{ name: 'join-game' }">
        Join another game
      </RouterLink>
      <!--
        The same match, minus the socket token: the history page identifies the reader
        by cookie or guest id, so this link keeps working in a new tab and tomorrow.
      -->
      <RouterLink
        v-if="game.sessionId"
        class="btn-ghost"
        :to="{ name: 'history-detail', params: { sessionId: game.sessionId } }"
      >
        Review later
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
