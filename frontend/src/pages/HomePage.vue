<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import QuizRail from '@/components/quiz/QuizRail.vue'
import QuizCard from '@/components/quiz/QuizCard.vue'
import { getHomeSections, getFeed } from '@/api/quizzes.api'
import { useCursorList } from '@/composables/useCursorList'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'
import { useAuthStore } from '@/stores/auth.store'
import { revealAppended, revealOnScroll, ScrollTrigger } from '@/composables/useMotion'
import StateBlock from '@/components/base/StateBlock.vue'
import SkeletonBlock from '@/components/base/SkeletonBlock.vue'

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
 *
 * The feed is deliberately unfiltered. The topic chips that used to sit above it were a
 * hardcoded taxonomy matched against a free-text column, so most of them returned an
 * empty page; a filter comes back once an endpoint can list the categories that really
 * exist. Until then the server-side ranking is the whole product here.
 */
const auth = useAuthStore()

const FEED_LIMIT = 12

// Section types that map straight onto a discover sort. Anything else falls back to
// plain discover, so an unknown section type still gets a working "See all".
const SECTION_SORTS = ['trending', 'newest', 'oldest', 'most_played', 'name_asc', 'name_desc']

const pageEl = ref(null)
const feedGridEl = ref(null)
const sentinelEl = ref(null)

// The signed-in state changes the section list, so it belongs in the cache key.
const audience = computed(() => (auth.isLoggedIn ? 'user' : 'guest'))

const home = useQuery({
  queryKey: ['quizzes', 'home', audience],
  queryFn: () => getHomeSections(),
})

const sections = computed(() => home.data.value?.sections ?? [])

// A rail is a row of four cards on a desktop viewport. A shorter one reads as a
// half-empty shelf rather than a curated pick, so a section is held back until it
// can fill the row. The backend already drops sections with no items at all.
const MIN_RAIL_ITEMS = 4

const rails = computed(() =>
  sections.value.filter((section) => (section.items?.length ?? 0) >= MIN_RAIL_ITEMS),
)

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
  () => ({ limit: FEED_LIMIT }),
  { errorFallback: 'Could not load the feed.' },
)

const feedItems = feed.items

useInfiniteScroll(sentinelEl, () => feed.loadMore())

const feedReveals = []

onMounted(() => {
  // Rails animate their own header and cards; this only covers the static sections.
  revealOnScroll(pageEl.value, '[data-reveal]', { y: 20, stagger: 0.06 })
})

// Every page appends into the same grid, so only the cards that are actually new may
// be touched. Rebuilding the reveal over the whole grid re-hid the cards the reader had
// already scrolled past, and those never came back: their trigger start sits behind the
// scroll position, so the enter callback that fades them in is never called again.
watch(feedItems, async (rows) => {
  if (!rows.length) return

  await nextTick()
  feedReveals.push(revealAppended(feedGridEl.value, '[data-reveal-card]', { y: 16, stagger: 0.04 }))
  // The page just got taller, so triggers further down need their start recomputed.
  ScrollTrigger.refresh()
})

onBeforeUnmount(() => {
  feedReveals.forEach((kill) => kill())
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
      <div class="card-surface">
        <StateBlock
          variant="error"
          :icon="'\u{26A0}\u{FE0F}'"
          title="Could not load the home sections"
          action-label="Try again"
          @action="home.refetch()"
        />
      </div>
    </div>

    <template v-else>
      <QuizRail
        v-for="section in rails"
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

      <div v-if="feed.loading.value" class="mt-lg grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonBlock
          v-for="n in 8"
          :key="`feed-skeleton-${n}`"
          :rows="1"
          height="h-[300px]"
          card
        />
      </div>

      <div v-else-if="feed.errorMessage.value" class="card-surface mt-lg">
        <StateBlock
          variant="error"
          :icon="'\u{26A0}\u{FE0F}'"
          :message="feed.errorMessage.value"
          title="Could not load the feed"
          action-label="Try again"
          @action="feed.loadFirst()"
        />
      </div>

      <div v-else-if="!feedItems.length" class="card-surface mt-lg">
        <StateBlock
          :icon="'\u{1F4ED}'"
          title="Nothing here yet"
          message="New quizzes show up as soon as they are published."
        />
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

        <p v-if="feed.loadingMore.value" class="mt-md text-center text-caption text-ink-3">
          Loading more…
        </p>
        <p v-else-if="!feed.hasMore.value" class="mt-md text-center text-caption text-ink-3">
          You have reached the end.
        </p>
      </template>
    </section>
  </div>
</template>
