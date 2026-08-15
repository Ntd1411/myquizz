<script setup>
import { computed } from 'vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import LeaderboardList from '@/components/game/LeaderboardList.vue'
import { useFinalResults } from '@/composables/useFinalResults'
import { useGameStore } from '@/stores/game.store'
import { useUiStore } from '@/stores/ui.store'

/**
 * Host end screen.
 *
 * The host always gets the full table, even in a room that hides the standings from the
 * players: hiding the leaderboard is about the game, not about the report.
 *
 * `perQuestion` is the reason this screen exists. A ranking says who won, the accuracy
 * per question says which question the room did not understand, which is the only part
 * a teacher can act on afterwards.
 */
const game = useGameStore()
const ui = useUiStore()
const { leaderboard, perQuestion, loading, error } = useFinalResults()

const rows = computed(() => leaderboard.value)
const playerCount = computed(() => rows.value.length)
const best = computed(() => rows.value[0] ?? null)
const average = computed(() => {
  if (!playerCount.value) return 0
  const sum = rows.value.reduce((total, row) => total + (row.player_score ?? 0), 0)
  return Math.round(sum / playerCount.value)
})

/**
 * The server groups the answers by question id and sends `question_index`, the position
 * the question was played at, ordered by it. Numbering rows by their position in this
 * list would be wrong as soon as the room shuffles the questions, so the index is used.
 */
const stats = computed(() =>
  perQuestion.value.map((row, position) => {
    const count = row.answer_count ?? 0
    const correct = row.correct_count ?? 0
    const index = row.question_index ?? position
    return {
      id: row.question_id ?? position,
      label: `Question ${index + 1}`,
      count,
      correct,
      percent: count ? Math.round((correct / count) * 100) : 0,
    }
  }),
)

// Top three in podium order (2nd, 1st, 3rd), so the winner stands in the middle.
const podium = computed(() => {
  const top = rows.value.slice(0, 3)
  if (top.length < 3) return []
  return [
    { row: top[1], place: 2 },
    { row: top[0], place: 1 },
    { row: top[2], place: 3 },
  ]
})

const answered = computed(() => stats.value.reduce((total, row) => total + row.count, 0))
// Worth calling out only when there is something to compare it against.
const hardest = computed(() => {
  const seen = stats.value.filter((row) => row.count > 0)
  if (seen.length < 2) return null
  return seen.reduce((worst, row) => (row.percent < worst.percent ? row : worst))
})

function toneOf(percent) {
  if (percent >= 60) return 'is-high'
  return percent >= 30 ? 'is-mid' : 'is-low'
}

async function copyStandings() {
  if (!rows.value.length) return
  // Tab separated, so it can be pasted straight into a spreadsheet.
  const text = rows.value
    .map((row) => [row.rank, row.player_name, row.player_score, row.correct_answers_count].join('\t'))
    .join('\n')
  const ok = await navigator.clipboard
    ?.writeText(text)
    .then(() => true)
    .catch(() => false)
  ui.toast(ok ? 'Standings copied.' : 'Copy failed, select the table instead.')
}
</script>

<template>
  <section class="grid gap-lg">
    <div class="card-surface hero p-xl">
      <p class="eyebrow-label">
        Match report
      </p>
      <h2 class="mt-xs text-heading-1 text-ink">
        The game is over
      </h2>
      <p v-if="best" class="mt-xxs text-body-md text-ink-2">
        {{ best.player_name }} takes first place with
        <span class="num">{{ best.player_score }}</span> points.
      </p>

      <!-- The three names the room is waiting for, before any table. -->
      <ol v-if="podium.length" class="podium">
        <li v-for="spot in podium" :key="spot.place" class="podium-spot" :class="`is-${spot.place}`">
          <span class="podium-place num">{{ spot.place }}</span>
          <span class="podium-name" :title="spot.row.player_name">{{ spot.row.player_name }}</span>
          <span class="podium-score num">{{ spot.row.player_score }}</span>
          <span class="podium-block" />
        </li>
      </ol>

      <div class="stat-row">
        <div class="stat">
          <p class="stat-value num">
            {{ playerCount }}
          </p>
          <p class="stat-label">
            Players
          </p>
        </div>
        <div class="stat">
          <p class="stat-value num">
            {{ average }}
          </p>
          <p class="stat-label">
            Average score
          </p>
        </div>
        <div class="stat">
          <p class="stat-value num">
            {{ answered }}
          </p>
          <p class="stat-label">
            Answers given
          </p>
        </div>
      </div>

      <p v-if="hardest" class="mt-lg text-body-sm text-ink-2">
        Hardest question: <span class="text-ink">{{ hardest.label }}</span>, only
        <span class="num">{{ hardest.percent }}%</span> got it right.
      </p>
    </div>

    <div v-if="loading && !rows.length" class="card-surface flex items-center gap-xs p-lg">
      <BaseSpinner />
      <span class="text-body-sm text-ink-2">Loading the report&hellip;</span>
    </div>
    <p v-else-if="error" class="card-surface p-lg text-body-sm text-ans-a">
      {{ error }}
    </p>

    <section v-if="rows.length" class="card-surface p-lg">
      <div class="flex flex-wrap items-center justify-between gap-sm">
        <p class="section-title">
          Final standings
        </p>
        <button class="btn-utility" type="button" @click="copyStandings">
          Copy standings
        </button>
      </div>
      <LeaderboardList class="mt-sm" :rows="rows" detailed />
    </section>

    <!-- Per question accuracy: the part of the report worth acting on. -->
    <section v-if="stats.length" class="card-surface p-lg">
      <p class="section-title">
        Accuracy per question
      </p>
      <ul class="mt-sm grid gap-xs">
        <li v-for="row in stats" :key="row.id" class="stat-line">
          <p class="stat-line-label">
            {{ row.label }}
          </p>
          <div class="bar">
            <div class="bar-fill" :class="toneOf(row.percent)" :style="{ width: `${row.percent}%` }" />
          </div>
          <p class="stat-line-value num">
            {{ row.percent }}%
          </p>
          <p class="stat-line-count">
            {{ row.correct }}/{{ row.count }}
          </p>
        </li>
      </ul>
    </section>
    <p v-else-if="!loading" class="card-surface p-lg text-body-sm text-ink-2">
      Nobody answered a question in this match, so there is nothing to report.
    </p>

    <div class="flex flex-wrap items-center gap-xs">
      <RouterLink class="btn-primary" :to="{ name: 'library' }">
        Back to my library
      </RouterLink>
      <span v-if="game.connection !== 'connected'" class="text-caption text-ink-3">
        Read from the saved results, the live connection is closed.
      </span>
    </div>
  </section>
</template>

<style scoped>
.hero {
  background:
    radial-gradient(110% 130% at 20% -20%, var(--spotlight-soft) 0%, transparent 60%),
    var(--paper);
}

.podium {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: end;
  gap: 12px;
  max-width: 560px;
  margin-top: 20px;
}

.podium-spot {
  display: grid;
  justify-items: center;
  gap: 4px;
  text-align: center;
}

.podium-place {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: var(--r-full);
  background: var(--canvas);
  color: var(--ink-2);
  font-size: 14px;
}

.podium-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
}

.podium-score {
  font-size: 13px;
  color: var(--ink-2);
}

.podium-block {
  width: 100%;
  margin-top: 8px;
  border-radius: var(--r-md) var(--r-md) 0 0;
  background: var(--wash);
}

.podium-spot.is-1 .podium-block {
  height: 84px;
  background: var(--ans-c-soft);
}

.podium-spot.is-1 .podium-place {
  background: var(--ans-c-soft);
  color: var(--ans-c);
}

.podium-spot.is-2 .podium-block {
  height: 60px;
}

.podium-spot.is-3 .podium-block {
  height: 42px;
}

.stat-row {
  margin-top: 20px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.stat {
  min-width: 120px;
  flex: 1 1 120px;
  padding: 12px 14px;
  border-radius: var(--r-lg);
  background: var(--canvas);
  border: 1px solid var(--hairline);
}

.stat-value {
  font-size: 26px;
  line-height: 1.1;
  color: var(--ink);
}

.stat-label {
  margin-top: 2px;
  font-size: 12px;
  color: var(--ink-3);
}

.stat-line {
  display: grid;
  grid-template-columns: minmax(90px, 1fr) minmax(0, 3fr) 46px 54px;
  align-items: center;
  gap: 10px;
}

.stat-line-label {
  font-size: 13px;
  color: var(--ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar {
  height: 8px;
  border-radius: var(--r-full);
  background: var(--canvas);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: var(--r-full);
  transition: width var(--t-slow) var(--ease);
}

.bar-fill.is-high {
  background: var(--ans-d);
}

.bar-fill.is-mid {
  background: var(--ans-c);
}

.bar-fill.is-low {
  background: var(--ans-a);
}

.stat-line-value {
  font-size: 13px;
  color: var(--ink);
  text-align: right;
}

.stat-line-count {
  font-size: 12px;
  color: var(--ink-3);
  text-align: right;
}

@media (max-width: 640px) {
  .stat-line {
    grid-template-columns: minmax(70px, 1fr) minmax(0, 2fr) 44px;
  }

  .stat-line-count {
    display: none;
  }
}
</style>
