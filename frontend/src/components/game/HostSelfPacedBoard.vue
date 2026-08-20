<script setup>
import { computed, ref } from 'vue'
import LeaderboardList from '@/components/game/LeaderboardList.vue'
import { useGameSocket } from '@/composables/useGameSocket'
import { useGameStore } from '@/stores/game.store'

/**
 * Host screen for the self-paced modes.
 *
 * There is no question to show here: every player is on their own question, so the server
 * never sends `host:question` and `game:next` is refused with a CONFLICT. What the host
 * gets instead is progress: `host:player-progress` after each answer, `player:finished`
 * and `player:eliminated` as people drop out, and the standings.
 *
 * The only controls that make sense are the ones that act on the whole room: pause, resume
 * and end.
 */
const game = useGameStore()
const socket = useGameSocket()

const ending = ref(false)

// A refused control is reported at the top of the board and replaced by the next one.
const actionError = ref('')

const total = computed(() => game.totalQuestions || 0)
const rows = computed(() =>
  [...game.players].sort((a, b) => (b.current_question_index ?? 0) - (a.current_question_index ?? 0)),
)
const done = computed(
  () => game.players.filter((p) => p.status === 'finished' || p.status === 'eliminated').length,
)
const standings = computed(() => (game.hostLeaderboard.length ? game.hostLeaderboard : game.leaderboard))

/**
 * How far this player got. A match budget loops the question bank, so there is no
 * denominator to show: the count keeps climbing until the clock runs out.
 */
function progressOf(row) {
  const at = row.current_question_index ?? 0
  const looping = Boolean(game.config?.timing?.totalMatchSeconds)
  if (looping || !total.value) return String(at)
  return `${Math.min(at, total.value)} / ${total.value}`
}

function statusOf(row) {
  if (row.status === 'eliminated') return 'Out'
  if (row.status === 'finished') return 'Finished'
  if (row.status === 'disconnected') return 'Offline'
  return 'Playing'
}

// The error channel is shared and keeps the last failure, so it has to be cleared before
// acting: otherwise an older error would be reported as the result of this click.
function guard(action, label) {
  game.setError(null)
  actionError.value = ''
  action()
  window.setTimeout(() => {
    // The store already carries the sentence for the code the server refused with.
    if (game.lastError) {
      console.warn(`${label} refused: ${game.lastError.code}`)
      actionError.value = game.lastError.message || `${label} did not go through. Try again.`
    }
  }, 600)
}

const pause = () => guard(socket.pause, 'Pause')
const resume = () => guard(socket.resume, 'Resume')

function end() {
  if (!ending.value) {
    ending.value = true
    return
  }
  guard(socket.endGame, 'End game')
  ending.value = false
}
</script>

<template>
  <div class="grid gap-lg">
    <p v-if="actionError" class="board-error" role="alert">
      <span v-text="actionError" />
    </p>

    <section v-if="game.isFinished" class="card-surface p-xl text-center">
      <h2 class="text-heading-2 text-ink">
        Game over
      </h2>
      <p class="mt-xs text-body-sm text-ink-2">
        Everyone is done. Full results arrive with the results screen.
      </p>
    </section>

    <section v-else class="card-surface p-xl">
      <div class="flex flex-wrap items-center justify-between gap-sm">
        <div>
          <p class="eyebrow-label">
            {{ game.isPaused ? 'Paused' : 'Everyone plays at their own pace' }}
          </p>
          <p class="mt-xxs text-body-sm text-ink-2">
            <span class="num text-ink">{{ done }}</span> of
            <span class="num text-ink">{{ game.players.length }}</span> finished
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-xs">
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
      </div>

      <p class="mt-md text-body-sm text-ink-3">
        There is no shared question in this mode, so there is nothing to advance from here.
      </p>
    </section>

    <section v-if="rows.length" class="card-surface p-lg">
      <p class="eyebrow-label">
        Progress
      </p>
      <ul class="mt-sm grid gap-xxs">
        <li v-for="row in rows" :key="row.id" class="progress-row">
          <span class="min-w-0 truncate text-body-sm text-ink">{{ row.player_name }}</span>
          <span class="num shrink-0 text-body-sm text-ink-2">{{ progressOf(row) }}</span>
          <span class="chip shrink-0">{{ statusOf(row) }}</span>
        </li>
      </ul>
    </section>

    <section v-if="standings.length" class="card-surface p-lg">
      <p class="eyebrow-label">
        Standings
      </p>
      <LeaderboardList class="mt-sm" :rows="standings" :detailed="true" />
    </section>
  </div>
</template>

<style scoped>
.progress-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: var(--r-md);
  border: 1px solid var(--hairline);
}

.board-error {
  padding: 10px 14px;
  border-radius: var(--r-md);
  border: 1px solid var(--ans-a);
  background: var(--ans-a-soft);
  color: var(--ans-a);
  font-size: 14px;
}
</style>
