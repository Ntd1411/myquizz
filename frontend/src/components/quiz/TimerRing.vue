<script setup>
import { computed } from 'vue'

/**
 * Countdown ring, design v2.1.
 *
 * The ring drains through stroke-dashoffset with a 1s linear transition, so it moves
 * continuously instead of stepping once per second. The remaining seconds sit in the
 * middle in the numeric face with tabular figures, which keeps the number from jittering
 * as digits change. Under five seconds the ring turns to Answer A - the only urgency
 * signal in the system.
 */
const props = defineProps({
  // Full length of the question, in seconds.
  total: { type: Number, required: true },
  remaining: { type: Number, required: true },
  size: { type: Number, default: 72 },
  stroke: { type: Number, default: 6 },
})

const radius = computed(() => (props.size - props.stroke) / 2)

const circumference = computed(() => 2 * Math.PI * radius.value)

const progress = computed(() => {
  if (props.total <= 0) return 0
  return Math.min(1, Math.max(0, props.remaining / props.total))
})

const dashOffset = computed(() => circumference.value * (1 - progress.value))

const isUrgent = computed(() => props.remaining <= 5)

const seconds = computed(() => Math.max(0, Math.ceil(props.remaining)))
</script>

<template>
  <div
    class="relative grid place-items-center"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="timer"
    :aria-label="`${seconds} seconds left`"
  >
    <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" aria-hidden="true">
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        stroke="var(--hairline)"
        :stroke-width="stroke"
      />
      <circle
        class="timer-ring-track"
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :stroke="isUrgent ? 'var(--ans-a)' : 'var(--spotlight)'"
        :stroke-width="stroke"
        stroke-linecap="round"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        :transform="`rotate(-90 ${size / 2} ${size / 2})`"
      />
    </svg>

    <span
      class="num absolute text-title"
      :style="{ color: isUrgent ? 'var(--ans-a)' : 'var(--ink)' }"
    >
      {{ seconds }}
    </span>
  </div>
</template>

<style scoped>
/* Linear on purpose: an eased drain would lie about how much time is left. */
.timer-ring-track {
  transition:
    stroke-dashoffset 1s linear,
    stroke var(--t-ui) var(--ease);
}

@media (prefers-reduced-motion: reduce) {
  .timer-ring-track {
    transition: none;
  }
}
</style>
