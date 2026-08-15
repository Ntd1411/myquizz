<script setup>
import { computed } from 'vue'

/**
 * Standings, in the two shapes the server sends them.
 *
 * `leaderboard:updated` gives the players a lean row (rank, name, score) while
 * `leaderboard:host` adds the monitoring columns. Both land here: `detailed` only
 * decides whether the extra columns are drawn, it never invents them.
 */
const props = defineProps({
  rows: { type: Array, default: () => [] },
  meId: { type: [Number, String], default: null },
  detailed: { type: Boolean, default: false },
  limit: { type: Number, default: 0 },
})

const visible = computed(() => (props.limit > 0 ? props.rows.slice(0, props.limit) : props.rows))

function isMe(row) {
  return props.meId !== null && String(row.id) === String(props.meId)
}

/** Only the host rows carry the counters, so the line is built from what is there. */
function detail(row) {
  const parts = []
  if (row.correct_count !== undefined) parts.push(`${row.correct_count} correct`)
  if (row.wrong_count !== undefined) parts.push(`${row.wrong_count} wrong`)
  if (row.streak) parts.push(`streak ${row.streak}`)
  if (row.lives !== null && row.lives !== undefined) parts.push(`${row.lives} lives`)
  if (row.status && row.status !== 'connected') parts.push(row.status)
  return parts.join(' \u00b7 ')
}
</script>

<template>
  <div>
    <TransitionGroup name="rank" tag="ol" class="grid gap-xxs">
      <li
        v-for="row in visible"
        :key="row.id"
        class="rank-row"
        :class="{ 'is-me': isMe(row) }"
      >
        <span class="rank-place num">{{ row.rank }}</span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-body-md text-ink">{{ row.player_name }}</span>
          <span v-if="detailed && detail(row)" class="block truncate text-caption text-ink-3">
            {{ detail(row) }}
          </span>
        </span>
        <span class="num text-body-md text-ink">{{ row.player_score }}</span>
      </li>
    </TransitionGroup>

    <p v-if="!visible.length" class="text-body-sm text-ink-3">
      No standings yet.
    </p>
  </div>
</template>

<style scoped>
.rank-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-md);
  background: var(--paper);
}

.rank-row.is-me {
  border-color: var(--spotlight-line);
  background: var(--spotlight-soft);
}

.rank-place {
  display: grid;
  place-items: center;
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: var(--r-full);
  background: var(--canvas);
  font-size: 12px;
  color: var(--ink-2);
}

/* Rows swap places every question, so the move is animated instead of jumping. */
.rank-move {
  transition: transform var(--t-slow) var(--ease);
}

.rank-enter-active,
.rank-leave-active {
  transition: opacity var(--t-ui) var(--ease);
}

.rank-enter-from,
.rank-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .rank-move,
  .rank-enter-active,
  .rank-leave-active {
    transition: none;
  }
}
</style>
