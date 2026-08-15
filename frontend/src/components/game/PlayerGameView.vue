<script setup>
import { computed, ref, watch } from 'vue'
import LeaderboardList from './LeaderboardList.vue'
import QuestionStage from './QuestionStage.vue'
import { useGameSocket } from '@/composables/useGameSocket'
import { useCountdown } from '@/composables/useServerClock'
import { useGameStore } from '@/stores/game.store'
import { useUiStore } from '@/stores/ui.store'

/**
 * The player side of a host-paced match: countdown, question, wait, results.
 *
 * Every phase change comes from the server (`current_phase`), never from a local timer.
 * The on-screen clock only reads the deadline the server sent, so a slow tab or a
 * reconnect shows less time left instead of quietly giving the player more.
 *
 * A single-choice tap is the answer, because a confirm step costs seconds in a race that
 * is scored on speed. Question types that build an answer (multiple_select, text) keep an
 * explicit submit, since there is no way to know when the player is done.
 *
 * The screen is the match: while a question is live nothing else is on it. Standings only
 * come back between two questions, together with the rank move, which is the one thing a
 * player wants to know once the answers are in.
 */
const game = useGameStore()
const socket = useGameSocket()
const ui = useUiStore()

const picks = ref([])
const text = ref('')
const sending = ref(false)

const question = computed(() => game.question)
const questionType = computed(() => question.value?.question_type ?? 'multiple_choice')
const isMulti = computed(() => questionType.value === 'multiple_select')
const isText = computed(() => ['short_answer', 'long_answer'].includes(questionType.value))

const phase = computed(() => game.currentPhase)
const answered = computed(() => game.currentAnswer)

const countdown = useCountdown(() => game.countdownStartsAt)
const timer = useCountdown(
  () => (phase.value === 'question_active' ? game.endsAt : null),
  { totalSeconds: computed(() => game.timeLimit) },
)
const nextIn = useCountdown(() => game.results?.nextQuestionAt ?? null)

const timeLeft = computed(() => timer.secondsLeft.value)
const urgent = computed(() => timeLeft.value !== null && timeLeft.value <= 5 && !answered.value)

// What the stage should paint as chosen: the submitted answer once it exists, the
// staged selection while the player is still building one.
const selected = computed(() => {
  const sent = answered.value?.answer
  if (sent === undefined || sent === null) return picks.value
  return Array.isArray(sent) ? sent : [sent]
})

const revealed = computed(() => phase.value === 'showing_results' && Boolean(game.results))
const correctAnswer = computed(() => game.results?.correct_answer ?? null)

/**
 * The room event carries the key but not who was right, so the outcome is worked out
 * here, unless the ack already graded this answer. Without a revealed key
 * (showCorrectAnswer=false) there is nothing to say at all.
 */
const outcome = computed(() => {
  if (!revealed.value) return null
  const graded = answered.value?.isCorrect
  if (graded === true) return 'correct'
  if (graded === false) return 'wrong'
  if (correctAnswer.value === null) return null
  const sent = answered.value?.answer
  if (sent === undefined || sent === null) return 'missed'
  const asKey = (value) => String(value ?? '').trim().toLowerCase()
  const want = (Array.isArray(correctAnswer.value) ? correctAnswer.value : [correctAnswer.value])
    .map(asKey)
    .sort()
  const got = (Array.isArray(sent) ? sent : [sent]).map(asKey).sort()
  if (!got.length) return 'missed'
  if (isMulti.value)
    return got.length === want.length && got.every((value, at) => value === want[at]) ? 'correct' : 'wrong'
  return want.includes(got[0]) ? 'correct' : 'wrong'
})

const scoreEarned = computed(() => answered.value?.scoreEarned ?? null)

const myRow = computed(
  () => game.leaderboard.find((row) => String(row.id) === String(game.playerId)) ?? null,
)

const myScore = computed(() => myRow.value?.player_score ?? game.player?.player_score ?? 0)

/**
 * Rank move between two questions.
 *
 * The baseline is taken when the question index changes, a moment where the leaderboard
 * still holds the previous round: comparing it with the standings that arrive with the
 * results is exactly the move this question caused. The first question has no baseline,
 * so it shows no notice instead of a fake "held your place".
 */
const rankBefore = ref(null)
const rankNow = computed(() => myRow.value?.rank ?? null)

const rankDelta = computed(() => {
  if (rankBefore.value === null || rankNow.value === null) return null
  return rankBefore.value - rankNow.value
})

const rankNotice = computed(() => {
  const delta = rankDelta.value
  if (delta === null) return null
  const places = Math.abs(delta) === 1 ? 'place' : 'places'
  if (delta > 0) return { tone: 'up', mark: '\u2191', text: `You moved up ${delta} ${places}` }
  if (delta < 0) return { tone: 'down', mark: '\u2193', text: `You dropped ${-delta} ${places}` }
  return { tone: 'same', mark: '\u2192', text: 'You held your place' }
})

const canSubmit = computed(() => {
  if (!game.canAnswer || sending.value) return false
  return isText.value ? text.value.trim().length > 0 : picks.value.length > 0
})

// A new question always starts from a clean slate, including after a reconnect.
watch(
  () => game.index,
  () => {
    picks.value = []
    text.value = ''
    rankBefore.value = rankNow.value
  },
)

async function send(value) {
  if (!game.canAnswer || sending.value) return
  sending.value = true
  await socket.answer(value).catch(() => {
    ui.toast(game.lastError?.message ?? 'Could not send your answer.', 'error')
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
</script>

<template>
  <div class="play">
    <!-- Countdown before the first question -->
    <section v-if="phase === 'countdown'" class="play-center">
      <p class="eyebrow-label">
        Get ready
      </p>
      <p class="num mt-md text-[96px] leading-none text-ink">
        {{ countdown.secondsLeft.value ?? 0 }}
      </p>
      <p class="mt-sm text-body-md text-ink-2">
        The first question is about to appear.
      </p>
    </section>

    <!-- Final screen. The full breakdown is a separate screen of its own. -->
    <section v-else-if="game.isFinished" class="play-center">
      <p class="final-mark">
        &#9733;
      </p>
      <h2 class="mt-md text-heading-1 text-ink">
        Thanks for playing
      </h2>
      <p v-if="myRow" class="mt-sm text-body-md text-ink-2">
        You finished <span class="num text-ink">#{{ myRow.rank }}</span> with
        <span class="num text-ink">{{ myRow.player_score }}</span> points.
      </p>
    </section>

    <!-- A live question owns the viewport: bar on top, answers in the middle, status below -->
    <template v-else-if="question">
      <header class="play-bar">
        <p class="stage-count">
          <span class="eyebrow-label">{{ game.isPaused ? 'Paused by the host' : 'Question' }}</span>
          <span class="num text-ink">{{ (question.index ?? 0) + 1 }}</span>
          <span class="text-ink-3">/ {{ question.total ?? game.totalQuestions }}</span>
        </p>

        <p v-if="timeLeft !== null" class="num play-clock" :class="{ 'is-urgent': urgent }">
          {{ timeLeft }}s
        </p>

        <p class="play-score">
          <span class="num">{{ myScore }}</span>
          <span class="text-caption text-ink-3">pts</span>
          <span v-if="rankNow" class="play-rank num">#{{ rankNow }}</span>
        </p>
      </header>

      <div v-if="timeLeft !== null" class="track">
        <div
          class="track-fill"
          :class="{ 'is-urgent': urgent }"
          :style="{ width: `${Math.round((timer.progress.value ?? 0) * 100)}%` }"
        />
      </div>

      <main class="play-main">
        <div class="stage-inner">
          <QuestionStage
            :question="question"
            :selected="selected"
            :correct-answer="correctAnswer"
            :stats="revealed ? game.results?.stats : null"
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
        </div>
      </main>

      <footer class="play-foot">
        <!-- One status block, so the player always knows what is being waited for -->
        <div v-if="revealed && outcome" class="verdict" :class="`is-${outcome}`">
          <span class="verdict-mark">
            {{ outcome === 'correct' ? '&#10003;' : outcome === 'wrong' ? '&#10007;' : '&#8987;' }}
          </span>
          <span class="verdict-text">
            <span class="verdict-title">
              {{ outcome === 'correct' ? 'Correct' : outcome === 'wrong' ? 'Not this time' : 'You did not answer' }}
            </span>
            <span v-if="scoreEarned" class="num verdict-score">+{{ scoreEarned }}</span>
          </span>
        </div>
        <p v-else-if="revealed" class="text-body-md text-ink-2">
          Answers are in.
        </p>
        <p v-else-if="phase === 'question_locked'" class="text-body-md text-ink-2">
          Time is up. Waiting for the results&hellip;
        </p>
        <p v-else-if="answered" class="text-body-md text-ink-2">
          Answer sent. Waiting for the other players&hellip;
        </p>

        <!-- Between two questions: the rank move first, the standings under it -->
        <div v-if="revealed" class="between">
          <p v-if="rankNotice" class="rank-notice" :class="`is-${rankNotice.tone}`">
            <span class="rank-notice-mark">{{ rankNotice.mark }}</span>
            <span>{{ rankNotice.text }}</span>
            <span v-if="rankNow" class="num rank-notice-place">now #{{ rankNow }}</span>
          </p>

          <div v-if="game.leaderboard.length" class="between-board">
            <p class="eyebrow-label">
              Standings
            </p>
            <LeaderboardList
              class="mt-sm"
              :rows="game.leaderboard"
              :me-id="game.playerId"
              :limit="5"
            />
          </div>

          <p v-if="nextIn.secondsLeft.value !== null" class="text-caption text-ink-3">
            Next question in <span class="num">{{ nextIn.secondsLeft.value }}</span>s
          </p>
          <p v-else class="text-caption text-ink-3">
            Waiting for the host to move on&hellip;
          </p>
        </div>
      </footer>
    </template>

    <!-- Between two questions the server may send nothing at all to look at -->
    <section v-else class="play-center">
      <p class="text-body-md text-ink-2">
        Waiting for the next question&hellip;
      </p>
    </section>
  </div>
</template>

<style scoped>
.play {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.play-center {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.play-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.stage-count {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 15px;
}

.play-clock {
  font-size: 28px;
  font-weight: 600;
  color: var(--ink);
}

.play-score {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 18px;
  font-weight: 600;
  color: var(--ink);
}

.play-rank {
  margin-left: 6px;
  padding: 2px 8px;
  border-radius: var(--r-full);
  background: var(--spotlight-soft);
  color: var(--spotlight);
  font-size: 14px;
}

.play-main {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.stage-inner {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
}

.play-foot {
  display: grid;
  gap: 10px;
}

.between {
  display: grid;
  gap: 10px;
}

.between-board {
  padding: 12px 14px;
  border-radius: var(--r-lg);
  border: 1px solid var(--hairline);
  background: var(--paper);
}

.rank-notice {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: var(--r-lg);
  border: 1px solid var(--hairline);
  background: var(--canvas);
  font-size: 16px;
  font-weight: 600;
}

.rank-notice-mark {
  font-size: 20px;
  line-height: 1;
}

.rank-notice-place {
  margin-left: auto;
  font-size: 14px;
  font-weight: 500;
  color: var(--ink-2);
}

.rank-notice.is-up {
  border-color: var(--ans-d);
  background: var(--ans-d-soft);
  color: var(--ans-d);
}

.rank-notice.is-down {
  border-color: var(--ans-a);
  background: var(--ans-a-soft);
  color: var(--ans-a);
}

.rank-notice.is-same {
  color: var(--ink-2);
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

.track-fill.is-urgent {
  background: var(--ans-a);
}

.num.is-urgent {
  color: var(--ans-a);
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
  background: var(--spotlight-soft);
  color: var(--spotlight);
  font-size: 28px;
}

@media (prefers-reduced-motion: reduce) {
  .track-fill {
    transition: none;
  }
}
</style>
