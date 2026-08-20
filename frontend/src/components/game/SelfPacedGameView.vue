<script setup>
import { computed, ref, watch } from 'vue'
import LeaderboardList from '@/components/game/LeaderboardList.vue'
import QuestionStage from '@/components/game/QuestionStage.vue'
import { useGameSocket } from '@/composables/useGameSocket'
import { useCountdown } from '@/composables/useServerClock'
import { useGameStore } from '@/stores/game.store'

/**
 * Player screen for the self-paced modes (solo, survival, marathon, practice).
 *
 * Nothing here is branched on the mode name: every difference comes from the config the
 * server sends. Lives appear because the server sends a lives counter, the match bar
 * appears because it sent a match deadline, the score disappears because scoring was
 * zeroed. A new mode with the same traits works without touching this file.
 *
 * The pace is per player, so unlike the host-paced screen there is no shared "locked" or
 * "results" phase: the answer is graded in the ack of `question:answer`, and the next
 * question either arrives on its own (autoAdvance) or after the player taps Next
 * (`question:next`, answered with `question:awaiting_next` on a reconnect).
 */
const game = useGameStore()
const socket = useGameSocket()

const picks = ref([])
const text = ref('')
const sending = ref(false)
const advancing = ref(false)

// Refusals are shown inside the question card, under the buttons that caused them,
// and die with the question they belong to.
const actionError = ref('')

const question = computed(() => game.question)
const questionType = computed(() => question.value?.question_type ?? 'multiple_choice')
const isMulti = computed(() => questionType.value === 'multiple_select')
const isText = computed(() => ['short_answer', 'long_answer'].includes(questionType.value))

const phase = computed(() => game.currentPhase)
const answered = computed(() => game.currentAnswer)
const awaiting = computed(() => game.awaitingNext)
// Only `question:timeout` writes here in a self-paced match, and applyQuestion clears it,
// so this always describes the question on screen.
const timeoutResult = computed(() => game.results)
const timedOut = computed(() => answered.value?.timedOut === true)

// Traits, read from the config instead of from the mode name.
const scored = computed(() => (game.config?.scoring?.basePoints ?? 0) > 0)
const hasLives = computed(() => game.lives !== null && game.lives !== undefined)
// The bank loops while a match budget is running, so the question count has no ceiling.
const hasMatchBudget = computed(() => Boolean(game.matchEndsAt))
const manual = computed(() => !game.autoAdvance)
const maxLives = computed(() => {
  const configured = game.config?.flow?.lives
  if (typeof configured === 'number' && configured > 0) return configured
  return Math.max(game.lives ?? 0, 1)
})

const me = computed(() => game.players.find((row) => String(row.id) === String(game.playerId)) ?? null)
const eliminated = computed(
  () => timeoutResult.value?.eliminated === true || me.value?.status === 'eliminated',
)
const finished = computed(() => phase.value === 'finished' || game.isFinished)

const selected = computed(() => {
  const sent = answered.value?.answer
  if (sent === undefined || sent === null) return picks.value
  return Array.isArray(sent) ? sent : [sent]
})

/**
 * The key only exists once the server decided to reveal it: with showCorrectAnswer off
 * the ack carries no answer at all, so the stage simply never gets one.
 */
const correctAnswer = computed(
  () =>
    answered.value?.correctAnswer ??
    timeoutResult.value?.correct_answer ??
    awaiting.value?.previous_result?.correct_answer ??
    null,
)
const revealed = computed(() => correctAnswer.value !== null && correctAnswer.value !== undefined)

const outcome = computed(() => {
  if (timedOut.value) return 'missed'
  const value = answered.value?.isCorrect
  if (value === true) return 'correct'
  if (value === false) return 'wrong'
  return null
})

const scoreEarned = computed(() => answered.value?.scoreEarned ?? null)
// The server grades a late answer as wrong unless the room allows it, and says so in the ack.
const answeredLate = computed(() => answered.value?.isLate === true)
const totalScore = computed(() => game.player?.player_score ?? 0)

const timer = useCountdown(() => (game.canAnswer ? game.endsAt : null), {
  totalSeconds: computed(() => game.timeLimit),
})
const countdown = useCountdown(() => game.countdownStartsAt)
const matchTimer = useCountdown(() => game.matchEndsAt)

// Practice usually has no per-question deadline at all, so there is no clock to show.
const hasDeadline = computed(() => Boolean(game.endsAt))
const timeLeft = computed(() => timer.secondsLeft.value ?? 0)
const urgent = computed(() => hasDeadline.value && timeLeft.value <= 5 && !answered.value)
// The buzzer went off but the room still accepts the answer: worth saying out loud.
const lateWindow = computed(
  () => hasDeadline.value && timeLeft.value <= 0 && !answered.value && game.allowAnswerLate,
)
const matchLeft = computed(() => matchTimer.secondsLeft.value ?? 0)
const matchPercent = computed(() => {
  const total = game.config?.timing?.totalMatchSeconds
  if (!total) return 0
  return Math.max(0, Math.min(100, (matchLeft.value / total) * 100))
})

const canSubmit = computed(() => {
  if (!game.canAnswer || sending.value) return false
  if (isText.value) return text.value.trim().length > 0
  if (isMulti.value) return picks.value.length > 0
  return false
})

watch(
  () => game.index,
  () => {
    picks.value = []
    text.value = ''
    actionError.value = ''
    advancing.value = false
  },
)

async function send(value) {
  if (!game.canAnswer || sending.value) return
  sending.value = true
  actionError.value = ''
  await socket.answer(value).catch((error) => {
    // The refusal is a code, and the store already paired it with a sentence: show that
    // one and keep the generic line for a code that has none.
    const refusal = game.lastError ?? error
    if (refusal) console.warn(`answer refused: ${refusal.code}`)
    actionError.value = refusal?.message || 'Could not send your answer. Try again.'
  })
  sending.value = false
}

function pick(value) {
  if (!game.canAnswer) return
  if (!isMulti.value) {
    send(value)
    return
  }
  const key = String(value)
  const at = picks.value.findIndex((entry) => String(entry) === key)
  if (at === -1) picks.value = [...picks.value, value]
  else picks.value = picks.value.filter((_, position) => position !== at)
}

function submit() {
  if (!canSubmit.value) return
  send(isText.value ? text.value.trim() : picks.value)
}

/**
 * `question:next` has no ack: either the next question arrives (the index watcher clears
 * the pending state) or a refusal lands on the error channel. The previous error is
 * cleared first, otherwise an older failure would be reported as this one.
 */
function goNext() {
  advancing.value = true
  actionError.value = ''
  game.setError(null)
  socket.playerNext()
  window.setTimeout(() => {
    advancing.value = false
    if (game.lastError?.event === 'question:next') {
      console.warn(`next question refused: ${game.lastError.code}`)
      actionError.value = game.lastError.message || 'Could not load the next question. Try again.'
    }
  }, 600)
}
</script>

<template>
  <div class="play-shell">
    <!-- Run status. Each part only exists in the modes that asked for it. -->
    <section
      v-if="!finished && !eliminated && (hasLives || hasMatchBudget || scored || question)"
      class="status-bar"
    >
      <p v-if="question" class="status-count">
        <span class="eyebrow-label">Question</span>
        <span class="num text-ink">{{ (question.index ?? 0) + 1 }}</span>
        <span v-if="!hasMatchBudget" class="text-ink-3">/ {{ question.total ?? game.totalQuestions }}</span>
      </p>

      <div v-if="hasLives" class="flex items-center gap-xs">
        <span class="eyebrow-label">Lives</span>
        <span class="flex items-center gap-xs">
          <span
            v-for="n in maxLives"
            :key="n"
            class="life"
            :class="{ 'is-lost': n > (game.lives ?? 0) }"
          >&#9829;</span>
        </span>
      </div>

      <p v-if="scored" class="status-score">
        <span class="eyebrow-label">Score</span>
        <span class="num text-ink">{{ totalScore }}</span>
      </p>

      <div v-if="hasMatchBudget" class="status-match">
        <div class="flex items-center justify-between gap-sm">
          <span class="eyebrow-label">Match time</span>
          <span class="num text-ink">{{ matchLeft }}s</span>
        </div>
        <div class="track mt-xs">
          <div class="track-fill" :style="{ width: `${matchPercent}%` }" />
        </div>
      </div>
    </section>

    <!-- Countdown before the first question -->
    <section v-if="phase === 'countdown'" class="wash-panel p-xl text-center">
      <p class="eyebrow-label">
        Get ready
      </p>
      <p class="num mt-sm text-[72px] leading-none text-ink">
        {{ countdown.secondsLeft.value ?? 0 }}
      </p>
      <p class="mt-sm text-body-sm text-ink-2">
        You play at your own pace once it starts.
      </p>
    </section>

    <!-- The player is out or done: the match itself may still be running for others. -->
    <section v-else-if="finished || eliminated" class="card-surface p-xl text-center">
      <p class="final-mark" :class="eliminated ? 'is-out' : 'is-done'">
        {{ eliminated ? '&#9829;' : '&#10003;' }}
      </p>
      <h2 class="mt-md text-heading-2 text-ink">
        {{ eliminated ? 'Out of lives' : 'Run complete' }}
      </h2>
      <p v-if="scored" class="mt-sm text-body-md text-ink-2">
        Final score <span class="num text-ink">{{ totalScore }}</span>
      </p>
      <p class="mt-xs text-body-sm text-ink-3">
        {{
          game.isFinished
            ? 'The match is over.'
            : 'Others are still playing. Standings keep updating until the host closes the room.'
        }}
      </p>
    </section>

    <!-- Question -->
    <section v-else-if="question" class="card-surface stage grow p-xl">
      <div v-if="hasDeadline || game.isPaused" class="mb-lg">
        <div class="flex items-center justify-between gap-sm">
          <p class="eyebrow-label">
            {{ game.isPaused ? 'Paused by the host' : 'Time for this question' }}
          </p>
          <p v-if="hasDeadline" class="num text-heading-2 text-ink" :class="{ 'is-urgent': urgent }">
            {{ timeLeft }}s
          </p>
        </div>
        <div v-if="hasDeadline" class="track mt-xs">
          <div
            class="track-fill"
            :class="{ 'is-urgent': urgent }"
            :style="{ width: `${Math.round((timer.progress.value ?? 0) * 100)}%` }"
          />
        </div>
      </div>

      <QuestionStage
        :question="question"
        :selected="selected"
        :correct-answer="correctAnswer"
        :reveal="revealed"
        :multi="isMulti"
        :disabled="!game.canAnswer"
        @pick="pick"
      />

      <label v-if="isText" class="mt-lg block">
        <span class="mb-xs block text-body-sm font-medium text-ink-2">Your answer</span>
        <input
          v-model="text"
          class="field"
          type="text"
          :disabled="!game.canAnswer"
          autocomplete="off"
          @keyup.enter="submit"
        >
      </label>

      <button
        v-if="(isMulti || isText) && !answered"
        class="btn-primary mt-md w-full"
        type="button"
        :disabled="!canSubmit"
        @click="submit"
      >
        {{ sending ? 'Sending\u2026' : 'Submit answer' }}
      </button>

      <p v-if="lateWindow" class="mt-md text-body-sm text-ink-2">
        Time is up, but this room still takes a late answer.
      </p>

      <!-- Feedback for this player alone: nobody else is on this question. -->
      <div v-if="outcome" class="verdict mt-lg" :class="`is-${outcome}`">
        <span class="verdict-mark">{{ outcome === 'correct' ? '&#10003;' : outcome === 'wrong' ? '&#10007;' : '&#8987;' }}</span>
        <span class="verdict-text">
          <span class="verdict-title">
            {{ outcome === 'correct' ? 'Correct' : outcome === 'wrong' ? 'Not this time' : 'Time is up' }}
          </span>
          <span v-if="scored && scoreEarned" class="num verdict-score">+{{ scoreEarned }}</span>
          <span v-if="answeredLate" class="verdict-note">Answered after the buzzer</span>
        </span>
      </div>

      <button
        v-if="manual && (outcome || awaiting)"
        class="btn-primary mt-lg w-full"
        type="button"
        :disabled="advancing"
        @click="goNext"
      >
        {{ advancing ? 'Loading\u2026' : 'Next question' }}
      </button>
      <p v-else-if="outcome" class="mt-md text-center text-body-sm text-ink-3">
        The next question is on its way&hellip;
      </p>

      <p v-if="actionError" class="mt-md text-center text-body-sm text-ans-a" role="alert">
        <span v-text="actionError" />
      </p>
    </section>

    <section v-else class="card-surface p-xl text-center">
      <p class="text-body-md text-ink-2">
        Getting your next question ready&hellip;
      </p>
    </section>

    <!-- Self-paced rooms usually only rank at the end, so this stays empty until then. -->
    <section v-if="game.leaderboard.length" class="card-surface p-lg">
      <p class="eyebrow-label">
        Standings
      </p>
      <LeaderboardList class="mt-sm" :rows="game.leaderboard" :me-id="game.playerId" :limit="10" />
    </section>
  </div>
</template>

<style scoped>
/* The run owns the viewport: the question grows, the status and standings stay put. */
.play-shell {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.status-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 24px;
  padding: 14px 20px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-xl);
  background: var(--paper);
}

.status-count,
.status-score {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 15px;
}

.status-match {
  flex: 1 1 180px;
  min-width: 160px;
}

.stage {
  border-radius: var(--r-xl);
}

.track {
  height: 6px;
  overflow: hidden;
  border-radius: var(--r-full);
  background: var(--hairline);
}

.track-fill {
  height: 100%;
  border-radius: var(--r-full);
  background: var(--spotlight);
  transition: width var(--t-ui) linear;
}

.track-fill.is-urgent,
.num.is-urgent {
  color: var(--ans-a);
  background: var(--ans-a);
}

.num.is-urgent {
  background: none;
}

.life {
  color: var(--ans-a);
  font-size: 18px;
  line-height: 1;
  transition: color var(--t-fast) var(--ease), opacity var(--t-fast) var(--ease);
}

.life.is-lost {
  color: var(--ink-3);
  opacity: 0.3;
}

.verdict {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-radius: var(--r-lg);
  border: 1px solid var(--hairline);
  background: var(--canvas);
}

.verdict-mark {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: var(--r-full);
  background: var(--paper);
  font-size: 18px;
}

.verdict-text {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
}

.verdict-title {
  font-size: 17px;
  font-weight: 600;
}

.verdict-score {
  font-size: 15px;
}

.verdict-note {
  font-size: 13px;
  color: var(--ink-3);
}

.verdict.is-correct {
  border-color: var(--ans-d);
  background: var(--ans-d-soft);
  color: var(--ans-d);
}

.verdict.is-wrong {
  border-color: var(--ans-a);
  background: var(--ans-a-soft);
  color: var(--ans-a);
}

.verdict.is-missed {
  color: var(--ink-2);
}

.final-mark {
  display: inline-grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: var(--r-full);
  font-size: 28px;
}

.final-mark.is-done {
  background: var(--ans-d-soft);
  color: var(--ans-d);
}

.final-mark.is-out {
  background: var(--ans-a-soft);
  color: var(--ans-a);
}

@media (prefers-reduced-motion: reduce) {
  .life,
  .track-fill {
    transition: none;
  }
}
</style>
