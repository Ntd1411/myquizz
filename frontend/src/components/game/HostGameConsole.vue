<script setup>
import { computed, ref } from 'vue'
import LeaderboardList from './LeaderboardList.vue'
import QuestionStage from './QuestionStage.vue'
import { useGameSocket } from '@/composables/useGameSocket'
import { useCountdown } from '@/composables/useServerClock'
import { useGameStore } from '@/stores/game.store'
import { useUiStore } from '@/stores/ui.store'

/**
 * The host console of a running host-paced match.
 *
 * The host is the only screen allowed to see the answer key while a question is open,
 * and it gets it on its own channel (`host:question`), so this component reads
 * `hostQuestion` and the player screens never receive that payload at all.
 *
 * The controls mirror what the server accepts: `game:next` exists only when the server
 * is not advancing on its own (`timing.autoAdvance`), otherwise it answers with a
 * CONFLICT. Hiding the button is the honest version of that rule.
 */
const game = useGameStore()
const socket = useGameSocket()
const ui = useUiStore()

const ending = ref(false)

const question = computed(() => game.hostQuestion?.question ?? null)
const phase = computed(() => game.currentPhase)
const manual = computed(() => !game.autoAdvance)

const countdown = useCountdown(() => game.countdownStartsAt)
const timer = useCountdown(
  () => (phase.value === 'question_active' ? game.endsAt : null),
  { totalSeconds: computed(() => game.timeLimit) },
)

// activePlayers only arrives with the first answer, so the roster is the fallback.
const expected = computed(() => game.activePlayers || game.connectedPlayers.length)
const revealStats = computed(() => phase.value === 'showing_results')

// question_active -> lock the question, showing_results -> send the next one.
const nextLabel = computed(() =>
  phase.value === 'question_active' ? 'Lock answers' : 'Next question',
)

/**
 * A socket emit has no ack: a refusal comes back later on the error channel. Reading it
 * right after the call would only ever find the previous failure, so the channel is
 * cleared first and read again once the server had a chance to answer.
 */
function guard(action, label) {
  game.setError(null)
  action()
  window.setTimeout(() => {
    if (game.lastError) ui.toast(`${label} failed: ${game.lastError.message}`, 'error')
  }, 600)
}

function next() {
  guard(socket.next, 'Advance')
}

function pause() {
  guard(socket.pause, 'Pause')
}

function resume() {
  guard(socket.resume, 'Resume')
}

function end() {
  if (!ending.value) {
    ending.value = true
    return
  }
  ending.value = false
  guard(socket.endGame, 'End game')
}
</script>

<template>
  <div class="grid gap-md">
    <section v-if="phase === 'countdown'" class="card-surface p-xl text-center">
      <p class="eyebrow-label">
        Starting
      </p>
      <p class="num mt-md text-[72px] leading-none text-ink">
        {{ countdown.secondsLeft.value ?? 0 }}
      </p>
      <p class="mt-sm text-body-sm text-ink-2">
        The first question goes out when this hits zero.
      </p>
    </section>

    <section v-else-if="game.isFinished" class="card-surface p-xl text-center">
      <p class="eyebrow-label">
        Game over
      </p>
      <h2 class="mt-xs text-heading-2 text-ink">
        The match is finished
      </h2>
      <p class="mt-sm text-body-sm text-ink-2">
        Final standings are below.
      </p>
    </section>

    <section v-else-if="question" class="card-surface p-xl">
      <div class="flex flex-wrap items-center justify-between gap-sm">
        <p class="eyebrow-label">
          {{ game.isPaused ? 'Paused' : 'Live question' }}
        </p>
        <div class="flex items-center gap-md">
          <p class="text-body-sm text-ink-2">
            <span class="num">{{ game.answeredCount }}</span> /
            <span class="num">{{ expected }}</span> answered
          </p>
          <p v-if="timer.secondsLeft.value !== null" class="num text-heading-3 text-ink">
            {{ timer.secondsLeft.value }}s
          </p>
        </div>
      </div>

      <!-- reveal is always on here: this is the host room copy of the question -->
      <QuestionStage
        class="mt-sm"
        :question="question"
        :correct-answer="game.hostQuestion?.correct_answer ?? null"
        :stats="revealStats ? game.results?.stats : null"
        :disabled="true"
        :reveal="true"
      />

      <div class="mt-lg flex flex-wrap items-center gap-xs">
        <button
          v-if="manual"
          class="btn-primary"
          type="button"
          :disabled="game.isPaused"
          @click="next"
        >
          {{ nextLabel }}
        </button>
        <button v-if="!game.isPaused" class="btn-utility" type="button" @click="pause">
          Pause
        </button>
        <button v-else class="btn-utility" type="button" @click="resume">
          Resume
        </button>
        <button class="btn-ghost" type="button" @click="end">
          {{ ending ? 'Tap again to end' : 'End game' }}
        </button>
      </div>

      <p v-if="!manual" class="mt-xs text-caption text-ink-3">
        The server moves on by itself between questions.
      </p>
    </section>

    <section v-else class="card-surface p-xl text-center">
      <p class="text-body-md text-ink-2">
        Waiting for the next question&hellip;
      </p>
    </section>

    <section v-if="game.hostLeaderboard.length" class="card-surface p-xl">
      <p class="eyebrow-label">
        Players
      </p>
      <LeaderboardList class="mt-sm" :rows="game.hostLeaderboard" :detailed="true" />
    </section>
  </div>
</template>
