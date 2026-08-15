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
 * The room event only carries the key, never who was right, so the outcome is worked
 * out here. Without a revealed key (showCorrectAnswer=false) there is nothing to say.
 */
const outcome = computed(() => {
  if (!revealed.value || correctAnswer.value === null) return null
  const sent = answered.value?.answer
  if (sent === undefined || sent === null) return 'missed'
  const asKey = (value) => String(value ?? '').trim().toLowerCase()
  const want = (Array.isArray(correctAnswer.value) ? correctAnswer.value : [correctAnswer.value])
    .map(asKey)
    .sort()
  const got = (Array.isArray(sent) ? sent : [sent]).map(asKey).sort()
  if (!got.length) return 'missed'
  if (isMulti.value)
    return got.length === want.length && got.every((v, i) => v === want[i]) ? 'correct' : 'wrong'
  return want.includes(got[0]) ? 'correct' : 'wrong'
})

const myRow = computed(() =>
  game.leaderboard.find((row) => String(row.id) === String(game.playerId)) ?? null,
)

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
  <div class="grid gap-md">
    <!-- Countdown before the first question -->
    <section v-if="phase === 'countdown'" class="card-surface p-xl text-center">
      <p class="eyebrow-label">
        Get ready
      </p>
      <p class="num mt-md text-[72px] leading-none text-ink">
        {{ countdown.secondsLeft.value ?? 0 }}
      </p>
      <p class="mt-sm text-body-sm text-ink-2">
        The first question is about to appear.
      </p>
    </section>

    <!-- Final screen. The full breakdown is a separate screen of its own. -->
    <section v-else-if="game.isFinished" class="card-surface p-xl text-center">
      <p class="eyebrow-label">
        Game over
      </p>
      <h2 class="mt-xs text-heading-2 text-ink">
        Thanks for playing
      </h2>
      <p v-if="myRow" class="mt-sm text-body-md text-ink-2">
        You finished <span class="num">#{{ myRow.rank }}</span> with
        <span class="num">{{ myRow.player_score }}</span> points.
      </p>
    </section>

    <!-- Question, waiting and results all share the same card so nothing jumps -->
    <section v-else-if="question" class="card-surface p-xl">
      <div class="flex items-center justify-between gap-sm">
        <p class="eyebrow-label">
          {{ game.isPaused ? 'Paused by the host' : 'Question' }}
        </p>
        <p v-if="timer.secondsLeft.value !== null" class="num text-heading-3 text-ink">
          {{ timer.secondsLeft.value }}s
        </p>
      </div>

      <QuestionStage
        class="mt-sm"
        :question="question"
        :selected="selected"
        :correct-answer="correctAnswer"
        :stats="revealed ? game.results?.stats : null"
        :disabled="!game.canAnswer"
        :reveal="revealed"
        @pick="pick"
      />

      <label v-if="isText" class="mt-lg block">
        <span class="mb-xxs block text-body-sm font-medium text-ink-2">Your answer</span>
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

      <!-- One status line, so the player always knows what is being waited for -->
      <p v-if="revealed && outcome === 'correct'" class="mt-md text-body-md" style="color: var(--ans-d)">
        Correct.
      </p>
      <p v-else-if="revealed && outcome === 'wrong'" class="mt-md text-body-md" style="color: var(--ans-a)">
        Not this time.
      </p>
      <p v-else-if="revealed && outcome === 'missed'" class="mt-md text-body-md text-ink-2">
        You did not answer this one.
      </p>
      <p v-else-if="revealed" class="mt-md text-body-md text-ink-2">
        Answers are in.
      </p>
      <p v-else-if="phase === 'question_locked'" class="mt-md text-body-md text-ink-2">
        Time is up. Waiting for the results&hellip;
      </p>
      <p v-else-if="answered" class="mt-md text-body-md text-ink-2">
        Answer sent. Waiting for the other players&hellip;
      </p>

      <p v-if="revealed && nextIn.secondsLeft.value !== null" class="mt-xxs text-caption text-ink-3">
        Next question in <span class="num">{{ nextIn.secondsLeft.value }}</span>s
      </p>
      <p v-else-if="revealed" class="mt-xxs text-caption text-ink-3">
        Waiting for the host to move on&hellip;
      </p>
    </section>

    <!-- Between two questions the server may send nothing at all to look at -->
    <section v-else class="card-surface p-xl text-center">
      <p class="text-body-md text-ink-2">
        Waiting for the next question&hellip;
      </p>
    </section>

    <section v-if="game.leaderboard.length" class="card-surface p-xl">
      <p class="eyebrow-label">
        Standings
      </p>
      <LeaderboardList
        class="mt-sm"
        :rows="game.leaderboard"
        :me-id="game.playerId"
        :limit="10"
      />
    </section>
  </div>
</template>
