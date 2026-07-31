<script setup>
import { computed } from 'vue'

const props = defineProps({
  quiz: { type: Object, required: true },
})

// Sticker palette used for decoration only, picked deterministically from the
// category name so the same category always gets the same cover colour.
const STICKER_COLORS = ['#62aef0', '#2a9d99', '#1aae39', '#dd5b00', '#ff64c8', '#391c57', '#523410']

function hashOf(value) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) % 9973
  return hash
}

const coverColor = computed(() => {
  const key = props.quiz.category || props.quiz.title || ''
  return STICKER_COLORS[hashOf(key) % STICKER_COLORS.length]
})

/** Mixes a hex colour toward white, same helper as the static demo. */
function lighten(hex, amount) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const mix = (channel) => Math.round(channel + (255 - channel) * amount)
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`
}

const initials = computed(() =>
  (props.quiz.title || 'MyQuizz')
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0] || '')
    .join('')
    .toUpperCase(),
)

// Inline SVG placeholder cover, identical in spirit to the demo's coverSvg().
const coverGradient = computed(
  () => `linear-gradient(135deg, ${coverColor.value}, ${lighten(coverColor.value, 0.4)})`,
)

const questionCount = computed(() => {
  if (typeof props.quiz.questionCount === 'number') return props.quiz.questionCount
  return Array.isArray(props.quiz.questions) ? props.quiz.questions.length : 0
})

const playCount = computed(() =>
  typeof props.quiz.playCount === 'number' ? props.quiz.playCount : null,
)

const authorName = computed(() => {
  const owner = props.quiz.owner
  if (!owner) return 'MyQuizz'
  return owner.fullname || owner.username || 'MyQuizz'
})
</script>

<template>
  <!-- Flat card: hairline border only, no hover lift. Motion belongs to the rail. -->
  <RouterLink
    :to="{ name: 'quiz-detail', params: { id: quiz.id } }"
    class="card-surface flex h-full select-none flex-col overflow-hidden"
  >
    <div
      class="relative aspect-[16/9] w-full border-b border-hairline"
      :style="{ background: coverGradient }"
    >
      <img
        v-if="quiz.imageUrl"
        :src="quiz.imageUrl"
        :alt="quiz.title"
        class="pointer-events-none h-full w-full object-cover"
        draggable="false"
        loading="lazy"
      />
      <template v-else>
        <span class="pointer-events-none absolute left-[7%] top-[18%] text-[54px] font-bold leading-none text-white/90">
          {{ initials }}
        </span>
        <span v-if="quiz.category" class="pointer-events-none absolute bottom-[10%] left-[7%] text-caption font-semibold text-white/85">
          {{ quiz.category }}
        </span>
      </template>
    </div>

    <div class="flex flex-1 flex-col gap-[10px] px-[20px] pb-[20px] pt-[18px]">
      <div class="flex items-center justify-between gap-[10px]">
        <span v-if="quiz.category" class="inline-flex items-center gap-xs text-[13px] text-ink-muted">
          <span class="h-[9px] w-[9px] rounded-xs" :style="{ backgroundColor: coverColor }"></span>
          {{ quiz.category }}
        </span>
        <span
          v-if="quiz.mode"
          class="whitespace-nowrap rounded-full border border-hairline px-[10px] py-[3px] text-eyebrow text-ink-muted"
        >
          {{ quiz.mode }}
        </span>
      </div>

      <!-- Clamped to exactly two lines so every card in a rail has the same height. -->
      <h3 class="line-clamp-2 min-h-[2.54em] text-heading-3 text-ink">{{ quiz.title }}</h3>

      <div class="mt-auto flex items-center gap-xs text-[13px] text-ink-faint">
        <span>{{ questionCount }} questions</span>
        <template v-if="playCount !== null">
          <span class="h-[3px] w-[3px] rounded-full bg-ink-faint"></span>
          <span>{{ playCount.toLocaleString('en-US') }} plays</span>
        </template>
        <span class="h-[3px] w-[3px] rounded-full bg-ink-faint"></span>
        <span>by {{ authorName }}</span>
      </div>
    </div>
  </RouterLink>
</template>
