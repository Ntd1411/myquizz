<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import QuizRail from '@/components/quiz/QuizRail.vue'
import QuizCard from '@/components/quiz/QuizCard.vue'
import { getHomeSections, getFeed } from '@/api/quizzes.api'
import { CATEGORIES, GAME_MODES } from '@/constants/quizMeta'
import { useCursorList } from '@/composables/useCursorList'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'
import { useAuthStore } from '@/stores/auth.store'
import { revealOnScroll, ScrollTrigger } from '@/composables/useMotion'

/**
 * Home screen, fully server driven.
 *
 * The rails come from GET /quizzes/home: the backend decides which sections exist,
 * in which order and with which title (home_sections), already drops empty ones and
 * only adds the "continue" row for a signed-in user. Nothing about a row is hardcoded
 * here, so adding a section is a backend-only change.
 *
 * Below the rails sits the endless feed on GET /quizzes/feed, ranked by hot_score and
 * paginated by its own cursor. It grows automatically when the sentinel under the last
 * card reaches the viewport.
 */
const auth = useAuthStore()

const FEED_LIMIT = 12

// Section types that map straight onto a discover sort. Anything else falls back to
// plain discover, so an unknown section type still gets a working "See all".
const SECTION_SORTS = ['trending', 'newest', 'oldest', 'most_played', 'name_asc', 'name_desc']

const pageEl = ref(null)
const feedGridEl = ref(null)
const sentinelEl = ref(null)
const topic = ref('')

// The signed-in state changes the section list, so it belongs in the cache key.
const audience = computed(() => (auth.isLoggedIn ? 'user' : 'guest'))

const home = useQuery({
  queryKey: ['quizzes', 'home', audience],
  queryFn: () => getHomeSections(),
})

const sections = computed(() => home.data.value?.sections ?? [])

/**
 * Turns a server section into its "See all" destination. The in-progress row has no
 * list page, so it deliberately gets no link.
 */
function seeAllFor(section) {
  if (section.type === 'continue') return null
  if (SECTION_SORTS.includes(section.type)) {
    return { name: 'discover', query: { sort: section.type } }
  }
  if (section.type === 'category') {
    return { name: 'discover', query: { category: section.title } }
  }
  return { name: 'discover' }
}

const feed = useCursorList(
  (params) => getFeed(params),
  () => ({ topic: topic.value, limit: FEED_LIMIT }),
  { errorFallback: 'Could not load the feed.' },
)

const feedItems = feed.items

function selectTopic(value) {
  topic.value = topic.value === value ? '' : value
}

useInfiniteScroll(sentinelEl, () => feed.loadMore())

let feedReveal = null

onMounted(() => {
  // Rails animate their own header and cards; this only covers the static sections.
  revealOnScroll(pageEl.value, '[data-reveal]', { y: 20, stagger: 0.06 })
})

// Feed cards are appended, so the reveal is rebuilt against the new nodes. Old
// triggers are killed first, otherwise a dead batch could leave cards at opacity 0.
watch(feedItems, async (rows) => {
  if (feedReveal) {
    feedReveal.forEach((trigger) => trigger.kill())
    feedReveal = null
  }
  if (!rows.length) return

  await nextTick()
  feedReveal = revealOnScroll(feedGridEl.value, '[data-reveal-card]', { y: 20, stagger: 0.04 })
  ScrollTrigger.refresh()
})
</script>

<template>
  <div ref="pageEl" class="pb-xxl pt-md">
    <!-- Server-driven rails. -->
    <template v-if="home.isLoading.value">
      <QuizRail
        v-for="n in 2"
        :key="`rail-skeleton-${n}`"
        title="Loading…"
        :items="[]"
        loading
      />
    </template>

    <div v-else-if="home.isError.value" class="container-page py-lg">
      <div class="card-surface p-xl">
        <p class="text-body-sm text-sticker-orange-deep">
          Could not load the home sections.
        </p>
        <button class="btn-utility mt-md" type="button" @click="home.refetch()">
          Try again
        </button>
      </div>
    </div>

    <template v-else>
      <QuizRail
        v-for="section in sections"
        :key="section.key"
        :title="section.title"
        :items="section.items"
        :see-all-to="seeAllFor(section)"
        see-all-label="See all"
      />
    </template>

    <!-- Endless feed, ranked server side by hot_score. -->
    <section class="container-page py-lg">
      <div class="mb-[20px] flex flex-wrap items-baseline justify-between gap-sm" data-reveal>
        <h2 class="section-title">
          Fresh for you
        </h2>
        <RouterLink :to="{ name: 'discover' }" class="section-link whitespace-nowrap">
          Browse everything
        </RouterLink>
      </div>

      <div class="flex flex-wrap gap-[10px]" data-reveal>
        <button
          v-for="item in CATEGORIES"
          :key="item.name"
          type="button"
          class="filter-chip"
          :class="topic === item.name ? 'is-active' : ''"
          :aria-pressed="topic === item.name"
          @click="selectTopic(item.name)"
        >
          <span class="h-[9px] w-[9px] shrink-0 rounded-full" :style="{ backgroundColor: item.color }" />
          {{ item.name }}
        </button>
      </div>

      <div v-if="feed.loading.value" class="mt-lg grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="n in 8"
          :key="`feed-skeleton-${n}`"
          class="h-[300px] animate-pulse rounded-lg bg-hairline/60"
        />
      </div>

      <div v-else-if="feed.errorMessage.value" class="card-surface mt-lg p-xl">
        <p class="text-body-sm text-sticker-orange-deep">
          {{ feed.errorMessage.value }}
        </p>
        <button class="btn-utility mt-md" type="button" @click="feed.loadFirst()">
          Try again
        </button>
      </div>

      <div v-else-if="!feedItems.length" class="card-surface mt-lg p-xl text-center">
        <p class="text-body-md text-ink">
          Nothing in this topic yet.
        </p>
        <button v-if="topic" class="btn-utility mt-md" type="button" @click="topic = ''">
          Show every topic
        </button>
      </div>

      <template v-else>
        <div
          ref="feedGridEl"
          class="mt-lg grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4"
        >
          <QuizCard
            v-for="quiz in feedItems"
            :key="quiz.id"
            :quiz="quiz"
            data-reveal-card
          />
        </div>

        <!-- Sentinel: reaching it asks for the next cursor page. -->
        <div ref="sentinelEl" class="h-px w-full" aria-hidden="true" />

        <p v-if="feed.loadingMore.value" class="mt-md text-center text-caption text-ink-faint">
          Loading more…
        </p>
        <p v-else-if="!feed.hasMore.value" class="mt-md text-center text-caption text-ink-faint">
          You have reached the end.
        </p>
      </template>
    </section>

    <section class="container-page py-lg">
      <h2 class="section-title mb-[20px]" data-reveal>
        Game modes
      </h2>
      <div class="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="mode in GAME_MODES"
          :key="mode.name"
          class="card-surface px-lg py-[22px]"
          data-reveal
        >
          <h3 class="text-title text-ink">
            {{ mode.name }}
          </h3>
          <p class="mt-xxs text-body-sm text-ink-muted">
            {{ mode.desc }}
          </p>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Topic chips are toggles, so they need a visible pressed state. */
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-full);
  background-color: var(--surface);
  color: var(--ink-secondary);
  font-size: 14px;
  transition:
    background-color 150ms ease,
    border-color 150ms ease,
    color 150ms ease,
    transform 150ms ease;
}

.filter-chip:hover {
  background-color: var(--canvas-soft);
}

.filter-chip:active {
  transform: scale(0.97);
}

.filter-chip.is-active {
  border-color: var(--ink);
  color: var(--ink);
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .filter-chip {
    transition: none;
  }

  .filter-chip:active {
    transform: none;
  }
}
</style>
