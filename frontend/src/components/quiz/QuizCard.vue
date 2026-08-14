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
 *
 * The author face doubles as the link to the public creator profile. It cannot live
 * inside the card link, so it is rendered as an overlay pinned exactly where the face
 * sits in the meta row, and the row keeps a spacer of the same size in its place.
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

// Placeholder cover: the category tint fading into paper. Distinct enough to tell two
// cards apart while scrolling, quiet enough that the initials stay legible on top.
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
 * The profile target. `owner` is the joined author block and is null once the account
 * is gone, while `ownerId` is the raw column that every listing carries; without either
 * one the face stays a plain avatar instead of linking into a 404.
 */
const ownerId = computed(() => owner.value?.id ?? props.quiz.ownerId ?? null)

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
    The card itself is one big link. The author link and the owner actions live in
    sibling overlays instead of inside it, because a link or a button nested in an
    anchor is invalid markup and the outer anchor steals the click.
  -->
  <div class="quiz-card-shell relative h-full">
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

        <!--
          The category reads under the name, in the order a card is actually scanned:
          what it is called, what kind of quiz it is, then the description. Over the
          cover it fought the artwork and covered whatever the author framed top-left.
          `self-start` keeps it hugging its text inside this column.
        -->
        <span
          v-if="quiz.category"
          class="tag pointer-events-none max-w-full self-start truncate"
          :style="tagStyle"
        >
          {{ quiz.category }}
        </span>

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

          <!--
            With a known author the face is a link, so the row only reserves its box
            here and the real avatar is rendered on top of the card.
          -->
          <span v-if="ownerId" class="ml-auto h-[24px] w-[24px]" aria-hidden="true" />
          <UserAvatar
            v-else
            class="ml-auto"
            :name="authorName"
            :src="authorAvatar"
            :size="24"
          />
        </div>
      </div>
    </RouterLink>

    <!-- Author shortcut, sitting exactly on the spacer the meta row left for it. -->
    <RouterLink
      v-if="ownerId"
      :to="{ name: 'user-profile', params: { id: ownerId } }"
      class="card-overlay owner-link absolute bottom-[16px] right-[18px]"
      :title="`View ${authorName}`"
    >
      <UserAvatar :name="authorName" :src="authorAvatar" :size="24" />
      <span class="sr-only">View the profile of {{ authorName }}</span>
    </RouterLink>

    <div v-if="$slots.actions" class="card-overlay absolute right-[10px] top-[10px] flex gap-xxs">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
/*
  One hover for every context. The card lifts 3px onto the soft two-layer shadow and
  drops its hairline, which reads as "picked up" instead of "highlighted".

  The hover is driven by the shell rather than the link, so pointing at an overlay is
  still pointing at the card: hovering the author face or an owner action used to end
  the hover on the link underneath and drop the card back down.
*/
.quiz-card,
.card-overlay {
  transition:
    transform var(--t-ui) var(--ease),
    box-shadow var(--t-ui) var(--ease),
    border-color var(--t-ui) var(--ease);
}

/* The overlays ride along with the lift, otherwise they slide off the card corner. */
.quiz-card-shell:hover .quiz-card,
.quiz-card-shell:hover .card-overlay {
  transform: translateY(-3px);
}

.quiz-card-shell:hover .quiz-card {
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

.quiz-card-shell:hover .quiz-card-cover {
  transform: scale(1.03);
}

/* The face is a target of its own, so it grows out of the card on hover. */
.owner-link {
  border-radius: var(--r-full);
}

.owner-link:hover {
  transform: scale(1.12);
  box-shadow: 0 0 0 3px var(--spotlight-soft);
}

.quiz-card-shell:hover .owner-link:hover {
  transform: translateY(-3px) scale(1.12);
}

.owner-link:active {
  transform: translateY(-3px) scale(1.02);
}

@media (prefers-reduced-motion: reduce) {
  .quiz-card,
  .card-overlay,
  .quiz-card-cover {
    transition: none;
  }

  .quiz-card-shell:hover .quiz-card,
  .quiz-card-shell:hover .card-overlay,
  .quiz-card-shell:hover .quiz-card-cover,
  .owner-link:hover,
  .quiz-card-shell:hover .owner-link:hover {
    transform: none;
  }
}
</style>
