<script setup>
import { computed } from 'vue'
import UserAvatar from '../base/UserAvatar.vue'
import { categoryTheme } from '../../constants/quizMeta'
import { groupDigits, formatCount } from '../../utils/formatNumber'

/**
 * Quiz card, design v2.1.
 *
 * Changes from v1, all of them removals: no coloured stripe across the top (it stacked
 * into a barcode in a grid), no author name next to the avatar (the face is enough at
 * this size, the name lives in the tooltip and on the detail page), and one single hover
 * behaviour shared by the grid and the rail so a card never feels like two components.
 */
const props = defineProps({
  quiz: { type: Object, required: true },
  /**
   * Owner view. Only /quizzes/search and /quizzes/me expose `is_public`, so the
   * private / empty badges are opt-in: home, feed and public profile rows have no
   * visibility field at all and must not guess one.
   */
  showOwnerBadges: { type: Boolean, default: false },
})

const theme = computed(() => categoryTheme(props.quiz.category || props.quiz.title || ''))

const initials = computed(() =>
  (props.quiz.title || 'MyQuizz')
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0] || '')
    .join('')
    .toUpperCase(),
)

// Placeholder cover: the category tint fading into paper. Quiet enough to sit behind a
// tag without fighting it, distinct enough to tell two cards apart while scrolling.
const coverStyle = computed(() => ({
  background: `linear-gradient(150deg, ${theme.value.tint}, #ffffff)`,
}))

const tagStyle = computed(() => ({
  backgroundColor: theme.value.tint,
  color: theme.value.color,
}))

const questionCount = computed(() => {
  if (typeof props.quiz.questionCount === 'number') return props.quiz.questionCount
  return Array.isArray(props.quiz.questions) ? props.quiz.questions.length : 0
})

const playCount = computed(() =>
  typeof props.quiz.playCount === 'number' ? props.quiz.playCount : null,
)

// Thousands are split by a 0.2em sliver, not a space: in a monospaced face a real
// space makes "1 204" read as two numbers.
const playGroups = computed(() => (playCount.value === null ? [] : groupDigits(playCount.value)))

const playTitle = computed(() =>
  playCount.value === null ? null : `${formatCount(playCount.value)} plays`,
)

const description = computed(() => props.quiz.description || props.quiz.quiz_description || '')

const owner = computed(() => props.quiz.owner ?? null)

const authorName = computed(() => owner.value?.fullname || owner.value?.username || 'MyQuizz')

const authorAvatar = computed(() => owner.value?.avatar || '')

/**
 * Owner-only badges. `isPublic` is null whenever the endpoint does not report
 * visibility, which is not the same as a private quiz, so only an explicit `false`
 * paints the private badge. A quiz without questions cannot be hosted, which is worth
 * flagging in the library.
 */
const badges = computed(() => {
  if (!props.showOwnerBadges) return []

  const list = []
  if (props.quiz.isPublic === false) list.push({ key: 'private', label: 'Private' })
  if (questionCount.value === 0) list.push({ key: 'empty', label: 'No questions' })
  return list
})
</script>

<template>
  <!--
    The card itself is one big link. Owner actions live in a sibling overlay instead of
    inside the link, because a button nested in an anchor is invalid markup and steals
    the click from the router.
  -->
  <div class="relative h-full">
    <RouterLink
      :to="{ name: 'quiz-detail', params: { id: quiz.id } }"
      class="quiz-card card-surface flex h-full select-none flex-col overflow-hidden"
    >
      <!-- 16:10 keeps the thumb calm; 16:9 made the text block look like an afterthought. -->
      <div
        class="relative aspect-[16/10] w-full overflow-hidden border-b border-hairline"
        :style="coverStyle"
      >
        <img
          v-if="quiz.imageUrl"
          :src="quiz.imageUrl"
          :alt="quiz.title"
          class="quiz-card-cover pointer-events-none h-full w-full object-cover"
          draggable="false"
          loading="lazy"
        >
        <span
          v-else
          class="pointer-events-none absolute inset-0 grid place-items-center text-[46px] font-bold leading-none"
          :style="{ color: theme.color, opacity: 0.28 }"
        >
          {{ initials }}
        </span>

        <!-- Category lives here, tinted, so the meta row underneath stays numbers only. -->
        <span
          v-if="quiz.category"
          class="tag pointer-events-none absolute left-[10px] top-[10px] max-w-[70%] truncate"
          :style="tagStyle"
        >
          {{ quiz.category }}
        </span>

        <span
          v-if="badges.length"
          class="pointer-events-none absolute bottom-[10px] left-[10px] flex flex-wrap gap-xxs"
        >
          <span
            v-for="badge in badges"
            :key="badge.key"
            class="rounded-sm border border-hairline bg-paper px-[8px] py-[3px] text-[11px] font-semibold text-ink-2"
          >
            {{ badge.label }}
          </span>
        </span>
      </div>

      <div class="flex flex-1 flex-col gap-[6px] px-[18px] pb-[16px] pt-[14px]">
        <!--
          Two lines max. The native title attribute shows the full text on hover, which
          also works for keyboard and screen-reader users without extra markup.
        -->
        <h3 class="line-clamp-2 min-h-[2.6em] text-title text-ink" :title="quiz.title">
          {{ quiz.title }}
        </h3>

        <!-- Description: smaller and fainter than the title, clipped to two lines. -->
        <p v-if="description" class="line-clamp-2 text-caption text-ink-3" :title="description">
          {{ description }}
        </p>

        <!--
          Last line: the two numbers that decide whether a quiz is worth opening, then
          the author's face pinned right. No name - it doubled the row height for a
          detail nobody scans a grid for.
        -->
        <div class="mt-auto flex items-center gap-xs pt-[6px] text-caption text-ink-3">
          <span class="num text-ink-2">{{ questionCount }}</span>
          <span class="-ml-[4px]">Q</span>
          <template v-if="playGroups.length">
            <span class="h-[3px] w-[3px] rounded-full bg-hairline" />
            <span class="num" :title="playTitle">
              <template v-for="(group, index) in playGroups" :key="index">
                <i v-if="index" class="ts" />{{ group }}
              </template>
            </span>
            <span class="-ml-[4px]">plays</span>
          </template>

          <UserAvatar
            class="ml-auto"
            :name="authorName"
            :src="authorAvatar"
            :size="24"
          />
        </div>
      </div>
    </RouterLink>

    <div v-if="$slots.actions" class="absolute right-[10px] top-[10px] flex gap-xxs">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
/*
  One hover for every context. The card lifts 3px onto the soft two-layer shadow and
  drops its hairline, which reads as "picked up" instead of "highlighted".
*/
.quiz-card {
  transition:
    transform var(--t-ui) var(--ease),
    box-shadow var(--t-ui) var(--ease),
    border-color var(--t-ui) var(--ease);
}

.quiz-card:hover {
  transform: translateY(-3px);
  border-color: transparent;
  box-shadow: var(--sh-2);
}

.quiz-card:active {
  transform: translateY(-1px);
  box-shadow: var(--sh-1);
}

.quiz-card-cover {
  transition: transform var(--t-slow) var(--ease);
}

.quiz-card:hover .quiz-card-cover {
  transform: scale(1.03);
}

@media (prefers-reduced-motion: reduce) {
  .quiz-card,
  .quiz-card-cover {
    transition: none;
  }

  .quiz-card:hover,
  .quiz-card:hover .quiz-card-cover {
    transform: none;
  }
}
</style>
