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

const description = computed(() => props.quiz.description || props.quiz.quiz_description || '')

const owner = computed(() => props.quiz.owner ?? null)

const authorName = computed(() => owner.value?.fullname || owner.value?.username || 'MyQuizz')

const authorAvatar = computed(() => owner.value?.avatar || null)

const authorInitial = computed(() => (authorName.value.trim()[0] || 'M').toUpperCase())

// "1000" stays readable as "1,000"; nothing is abbreviated so the number never lies.
const playLabel = computed(() =>
  playCount.value === null ? null : playCount.value.toLocaleString('en-US'),
)
</script>

<template>
  <!-- The whole card is the link. Hover lifts it slightly and zooms the cover. -->
  <RouterLink
    :to="{ name: 'quiz-detail', params: { id: quiz.id } }"
    class="quiz-card card-surface flex h-full select-none flex-col overflow-hidden"
  >
    <div
      class="relative aspect-[16/9] w-full overflow-hidden border-b border-hairline"
      :style="{ background: coverGradient }"
    >
      <img
        v-if="quiz.imageUrl"
        :src="quiz.imageUrl"
        :alt="quiz.title"
        class="quiz-card-cover pointer-events-none h-full w-full object-cover"
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

    <div class="flex flex-1 flex-col gap-[8px] px-[20px] pb-[18px] pt-[16px]">
      <span v-if="quiz.category" class="inline-flex items-center gap-xs text-[13px] text-ink-muted">
        <span class="h-[9px] w-[9px] rounded-xs" :style="{ backgroundColor: coverColor }"></span>
        {{ quiz.category }}
      </span>

      <!--
        Two lines max. The native title attribute shows the full text on hover, which
        also works for keyboard and screen-reader users without extra markup.
      -->
      <h3 class="line-clamp-2 min-h-[2.54em] text-heading-3 text-ink" :title="quiz.title">
        {{ quiz.title }}
      </h3>

      <!-- Description: smaller and fainter than the title, clipped to two lines. -->
      <p
        v-if="description"
        class="line-clamp-2 text-caption text-ink-faint"
        :title="description"
      >
        {{ description }}
      </p>

      <!-- Last line: question count, play count, then the author's avatar and name. -->
      <div class="mt-auto flex items-center gap-xs pt-xxs text-[13px] text-ink-faint">
        <span class="font-medium text-ink-muted">{{ questionCount }} Q</span>
        <template v-if="playLabel">
          <span class="h-[3px] w-[3px] rounded-full bg-ink-faint"></span>
          <span>{{ playLabel }}</span>
        </template>
        <span class="ml-auto flex min-w-0 items-center gap-xxs" :title="authorName">
          <span class="grid h-[20px] w-[20px] shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-hairline">
            <img
              v-if="authorAvatar"
              :src="authorAvatar"
              :alt="authorName"
              class="h-full w-full object-cover"
              draggable="false"
              loading="lazy"
            />
            <span
              v-else
              class="grid h-full w-full place-items-center text-[10px] font-semibold text-white"
              :style="{ backgroundColor: coverColor }"
            >
              {{ authorInitial }}
            </span>
          </span>
          <span class="truncate">{{ authorName }}</span>
        </span>
      </div>
    </div>
  </RouterLink>
</template>

<style scoped>
.quiz-card {
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    border-color 180ms ease;
}

.quiz-card:hover {
  transform: translateY(-4px);
  border-color: rgba(0, 0, 0, 0.14);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.1);
}

.quiz-card:active {
  transform: translateY(-1px);
}

.quiz-card-cover {
  transition: transform 320ms ease;
}

.quiz-card:hover .quiz-card-cover {
  transform: scale(1.04);
}

@media (prefers-reduced-motion: reduce) {
  .quiz-card,
  .quiz-card-cover {
    transition: none;
  }

  .quiz-card:hover {
    transform: none;
  }

  .quiz-card:hover .quiz-card-cover {
    transform: none;
  }
}
</style>
