<script setup>
import { computed, onMounted, ref } from 'vue'
import AnswerReviewList from '@/components/game/AnswerReviewList.vue'
import LeaderboardList from '@/components/game/LeaderboardList.vue'
import SkeletonBlock from '@/components/base/SkeletonBlock.vue'
import { getGameSummary, getMyAnswers } from '@/api/games.api'
import { toErrorMessage } from '@/api/envelope'
import { modeLabel } from '@/constants/gameConfig'
import { revealOnEnter } from '@/composables/useMotion'
import { useAuthStore } from '@/stores/auth.store'

/**
 * One past match, opened from the history list or from a shared link.
 *
 * Two requests on purpose: the overview is what everyone in that room may read, the
 * answer sheet is personal. A host has no answers of their own, so the second request
 * is only made when the overview says the reader held a seat - a 403 there would be a
 * normal outcome shown as an error.
 *
 * The page is built as one hero card plus one card per report, the same furniture the
 * end-of-game screen uses, so a match read days later looks like the match itself.
 */

const props = defineProps({
  sessionId: { type: [String, Number], required: true },
})

const auth = useAuthStore()

const pageEl = ref(null)

const summary = ref(null)
const loading = ref(true)
const errorMessage = ref('')

const answers = ref(null)
const answersLoading = ref(false)
const answersError = ref('')

const session = computed(() => summary.value?.session ?? null)
const quiz = computed(() => summary.value?.quiz ?? null)
const isHost = computed(() => Boolean(summary.value?.viewer?.isHost))
const playerId = computed(() => summary.value?.viewer?.playerId ?? null)
const leaderboard = computed(() => summary.value?.leaderboard ?? [])
const perQuestion = computed(() => summary.value?.perQuestion ?? [])

const isCancelled = computed(() => session.value?.session_status === 'cancelled')

/**
 * LeaderboardList reads `correct_count`, while the standings query answers with the
 * column name of the row it came from. Renaming happens here rather than in the query
 * so the live report and this page keep sharing one payload.
 */
const rows = computed(() =>
  leaderboard.value.map((row) => ({ ...row, correct_count: row.correct_answers_count })),
)
const items = computed(() => answers.value?.items ?? [])

const myRow = computed(
  () => leaderboard.value.find((row) => String(row.id) === String(playerId.value)) ?? null,
)

const endedAt = computed(() => {
  const value = session.value?.finished_at ?? null
  if (!value) return ''
  const stamp = new Date(value)
  return Number.isNaN(stamp.getTime()) ? '' : stamp.toLocaleString()
})

// The facts about the room itself, as one labelled record rather than a grey run-on.
const facts = computed(() => {
  const row = session.value
  if (!row) return []

  const list = [{ key: 'room', label: 'Room', value: row.session_name || '\u2014' }]

  if (row.session_host_name) {
    list.push({ key: 'host', label: 'Host', value: row.session_host_name })
  }

  if (endedAt.value) {
    list.push({ key: 'ended', label: 'Ended', value: endedAt.value })
  }

  list.push({
    key: 'size',
    label: 'Size',
    value: `${row.total_questions ?? 0} questions \u00b7 ${row.total_players ?? 0} players`,
  })

  return list
})

// Shown to a player only: a host holds no seat, so these three figures would be blank.
const myStats = computed(() => {
  const row = myRow.value
  if (!row) return []

  return [
    { key: 'score', label: 'Score', value: row.player_score ?? 0 },
    { key: 'rank', label: `Rank of ${leaderboard.value.length}`, value: `#${row.rank}` },
    {
      key: 'correct',
      label: 'Correct',
      value: row.correct_answers_count ?? 0,
      total: session.value?.total_questions ?? null,
    },
  ]
})

function accuracy(row) {
  if (!row.answer_count) return 0
  return Math.round((row.correct_count / row.answer_count) * 100)
}

async function loadAnswers() {
  answersLoading.value = true
  answersError.value = ''
  try {
    answers.value = await getMyAnswers(props.sessionId, { asGuest: !auth.isLoggedIn })
  } catch (error) {
    // The room may simply have review turned off; that is a setting, not a failure.
    answersError.value = toErrorMessage(error, 'Your answers are not available for this match.')
  } finally {
    answersLoading.value = false
  }
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    summary.value = await getGameSummary(props.sessionId, { asGuest: !auth.isLoggedIn })
  } catch (error) {
    summary.value = null
    errorMessage.value = toErrorMessage(error, 'That match could not be opened.')
  } finally {
    loading.value = false
  }

  if (playerId.value !== null) await loadAnswers()
}

onMounted(async () => {
  revealOnEnter(pageEl.value)
  await load()
})
</script>

<template>
  <div ref="pageEl" class="container-page pb-xxl pt-lg">
    <RouterLink class="back-link" :to="{ name: 'history' }" data-enter>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m14 6-6 6 6 6" />
      </svg>
      Play history
    </RouterLink>

    <!-- Card-shaped placeholder, so the hero does not jump when the match lands. -->
    <div v-if="loading" class="hero is-loading">
      <span class="skeleton-cover" />
      <span class="skeleton-body">
        <span class="skeleton-line" style="width: 22%" />
        <span class="skeleton-line skeleton-line-tall" style="width: 54%" />
        <span class="skeleton-line" style="width: 38%" />
      </span>
    </div>

    <div v-else-if="errorMessage" class="state-card is-error">
      <p class="state-title">
        Match not available
      </p>
      <p class="state-text">
        {{ errorMessage }}
      </p>
      <button class="btn-utility mt-md" type="button" @click="load">
        Try again
      </button>
    </div>

    <template v-else-if="summary">
      <!-- Hero: the quiz as it was played, read from the immutable snapshot. -->
      <section class="hero">
        <span class="hero-cover">
          <img
            v-if="quiz?.quiz_image"
            :src="quiz.quiz_image"
            alt=""
          >
          <span v-else class="hero-cover-letter" aria-hidden="true">
            {{ (quiz?.quiz_name || '?').trim().charAt(0).toUpperCase() }}
          </span>
        </span>

        <div class="hero-main">
          <div class="hero-chips">
            <span class="chip chip-brand">{{ modeLabel(session?.game_mode) }}</span>
            <span v-if="isCancelled" class="chip chip-warn">Cancelled</span>
            <span v-if="isHost" class="chip">You hosted</span>
          </div>

          <h1 class="hero-title">
            {{ quiz?.quiz_name || 'Deleted quiz' }}
          </h1>

          <p v-if="quiz?.quiz_description" class="hero-desc">
            {{ quiz.quiz_description }}
          </p>

          <!-- One labelled fact per line: a small record of the room, not grey prose. -->
          <dl class="fact-list">
            <div v-for="fact in facts" :key="fact.key" class="fact-row">
              <dt class="fact-key">
                {{ fact.label }}
              </dt>
              <dd class="fact-value">
                {{ fact.value }}
              </dd>
            </div>
          </dl>

          <p v-if="isCancelled" class="hero-note">
            This room was cancelled before it ended, so the scores below only cover the
            questions that were played.
          </p>
        </div>

        <!-- The reader's own result, the first thing they came back for. -->
        <dl v-if="myStats.length" class="stat-strip">
          <div v-for="stat in myStats" :key="stat.key" class="stat">
            <dt class="stat-label">
              {{ stat.label }}
            </dt>
            <dd class="stat-value num">
              {{ stat.value }}<span v-if="stat.total !== null && stat.total !== undefined" class="stat-total">/{{ stat.total }}</span>
            </dd>
          </div>
        </dl>
      </section>

      <section v-if="leaderboard.length" class="panel">
        <div class="panel-head">
          <h2 class="panel-title">
            Standings
          </h2>
          <span class="panel-count">{{ leaderboard.length }} players</span>
        </div>
        <!-- The host sees the monitoring columns, exactly as in the live report. -->
        <LeaderboardList
          :rows="rows"
          :me-id="playerId"
          :detailed="isHost"
        />
      </section>

      <!-- Host report: which questions the room actually got right. -->
      <section v-if="isHost && perQuestion.length" class="panel">
        <div class="panel-head">
          <h2 class="panel-title">
            Accuracy per question
          </h2>
          <span class="panel-count">{{ perQuestion.length }} questions</span>
        </div>

        <ol class="accuracy-list">
          <li v-for="row in perQuestion" :key="row.question_id" class="accuracy-row">
            <span class="accuracy-index num">Q{{ row.question_index + 1 }}</span>
            <span class="accuracy-track">
              <span
                class="accuracy-fill"
                :class="accuracy(row) < 50 ? 'is-low' : ''"
                :style="{ width: `${accuracy(row)}%` }"
              />
            </span>
            <span class="accuracy-value num">{{ accuracy(row) }}%</span>
            <span class="accuracy-count num">{{ row.correct_count }}/{{ row.answer_count }}</span>
          </li>
        </ol>
      </section>

      <!-- The reader's own answers, the same list the end-of-game screen shows. -->
      <section v-if="playerId !== null" class="panel">
        <div class="panel-head">
          <h2 class="panel-title">
            Your answers
          </h2>
          <span v-if="items.length" class="panel-count">{{ items.length }} questions</span>
        </div>

        <SkeletonBlock v-if="answersLoading" :rows="3" height="h-16" />
        <p v-else-if="answersError" class="panel-note is-error" role="alert">
          {{ answersError }}
        </p>
        <AnswerReviewList v-else-if="items.length" :items="items" />
        <p v-else class="panel-note">
          No questions came back for this match.
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ink-3);
  font-size: 13px;
  transition: color var(--t-ui) var(--ease);
}

.back-link svg {
  width: 15px;
  height: 15px;
}

.back-link:hover {
  color: var(--spotlight);
}

/*
  Hero: cover and identity on one row, the reader's own figures underneath on their own
  line so the three tiles keep their width whatever the quiz is called.
*/
.hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  column-gap: 22px;
  row-gap: 0;
  margin-top: 14px;
  padding: 24px 26px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-xl);
  background-color: var(--paper);
}

.hero-cover {
  display: grid;
  place-items: center;
  overflow: hidden;
  width: 260px;
  aspect-ratio: 16 / 10;
  border-radius: var(--r-lg);
  background-color: var(--canvas);
}

.hero-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-cover-letter {
  color: var(--ink-3);
  font-size: 56px;
  font-weight: 700;
  line-height: 1;
}

.hero-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.hero-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.hero-title {
  margin-top: 10px;
  color: var(--ink);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.022em;
  line-height: 1.18;
  overflow-wrap: anywhere;
}

.hero-desc {
  max-width: 58ch;
  margin-top: 8px;
  color: var(--ink-2);
  font-size: 14.5px;
  line-height: 1.55;
}

/* A caveat about the numbers below, so it sits with them rather than with the title. */
.hero-note {
  max-width: 58ch;
  margin-top: 12px;
  color: var(--ink-3);
  font-size: 12.5px;
  line-height: 1.45;
}

/*
  The key column has a fixed width, which is what lines the values up under each other
  whatever the label says.
*/
.fact-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 14px;
}

.fact-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.fact-key {
  flex: none;
  width: 54px;
  color: var(--ink-3);
  font-size: 12.5px;
}

.fact-value {
  min-width: 0;
  overflow: hidden;
  color: var(--ink-2);
  font-size: 13.5px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Its own band under the identity, far enough down to read as a separate statement. */
.stat-strip {
  display: flex;
  flex-wrap: wrap;
  grid-column: 1 / -1;
  gap: 12px;
  margin-top: 24px;
}

.stat {
  flex: 1 1 140px;
  padding: 14px 18px;
  border-radius: var(--r-md);
  background-color: var(--canvas);
}

.stat-label {
  color: var(--ink-3);
  font-size: 12px;
  letter-spacing: 0.01em;
  line-height: 1.3;
}

.stat-value {
  margin-top: 6px;
  color: var(--ink);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.1;
}

.stat-total {
  color: var(--ink-3);
  font-size: 14px;
  font-weight: 600;
}

.chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-full);
  background-color: var(--canvas);
  color: var(--ink-2);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1;
  white-space: nowrap;
}

/* What the room was: the one fact worth the brand colour. */
.chip-brand {
  border-color: var(--spotlight-line);
  background-color: var(--spotlight-soft);
  color: var(--spotlight);
}

/* A room that never finished, so the scores are partial. */
.chip-warn {
  border-color: var(--ans-a);
  background-color: var(--ans-a-soft);
  color: var(--ans-a);
}

/* One report per card, each with the same heading bar. */
.panel {
  margin-top: 16px;
  padding: 20px 22px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  background-color: var(--paper);
}

.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.panel-title {
  color: var(--ink);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.016em;
}

.panel-count {
  flex: none;
  color: var(--ink-3);
  font-size: 12.5px;
}

.panel-note {
  color: var(--ink-2);
  font-size: 14px;
  line-height: 1.5;
}

.panel-note.is-error {
  color: var(--ans-a);
}

.accuracy-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
}

/*
  Four fixed columns: the label, the bar, the share, the raw count. Fixed widths on
  everything but the bar is what makes the percentages read as a column.
*/
.accuracy-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 44px 56px;
  align-items: center;
  gap: 10px;
}

.accuracy-index {
  color: var(--ink-3);
  font-size: 12px;
}

.accuracy-track {
  overflow: hidden;
  height: 8px;
  border-radius: var(--r-full);
  background-color: var(--wash);
}

.accuracy-fill {
  display: block;
  height: 100%;
  border-radius: var(--r-full);
  background-color: var(--ans-c);
}

/* Under half the room got it: the bar says so without a second label. */
.accuracy-fill.is-low {
  background-color: var(--ans-a);
}

.accuracy-value {
  color: var(--ink);
  font-size: 12.5px;
  font-weight: 600;
  text-align: right;
}

.accuracy-count {
  color: var(--ink-3);
  font-size: 12px;
  text-align: right;
}

.state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 14px;
  padding: 48px 24px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  background-color: var(--paper);
  text-align: center;
}

.state-card.is-error {
  border-color: var(--ans-a);
  background-color: var(--ans-a-soft);
}

.state-title {
  color: var(--ink);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.014em;
}

.state-text {
  max-width: 420px;
  margin-top: 8px;
  color: var(--ink-2);
  font-size: 15px;
  line-height: 1.5;
}

.hero.is-loading {
  align-items: center;
}

.skeleton-cover {
  display: block;
  width: 260px;
  aspect-ratio: 16 / 10;
  border-radius: var(--r-lg);
  background-color: var(--canvas);
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

.skeleton-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.skeleton-line {
  display: block;
  height: 12px;
  border-radius: var(--r-sm);
  background-color: var(--canvas);
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

.skeleton-line-tall {
  height: 24px;
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.55;
  }
}

/* Below this width the cover cannot share the row without squeezing the title. */
@media (max-width: 680px) {
  .hero {
    grid-template-columns: minmax(0, 1fr);
    row-gap: 16px;
    padding: 20px;
  }

  .hero-cover,
  .skeleton-cover {
    width: 100%;
    max-width: 420px;
  }

  .hero-title {
    font-size: 24px;
  }

  .panel {
    padding: 18px 16px;
  }

  .accuracy-row {
    grid-template-columns: 30px minmax(0, 1fr) 42px;
  }

  .accuracy-count {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .back-link {
    transition: none;
  }

  .skeleton-cover,
  .skeleton-line {
    animation: none;
  }
}
</style>
