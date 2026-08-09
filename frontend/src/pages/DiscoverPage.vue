<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QuizCard from '@/components/quiz/QuizCard.vue'
import { searchQuizzes } from '@/api/quizzes.api'
import { CATEGORIES } from '@/constants/quizMeta'
import { useCursorList } from '@/composables/useCursorList'
import { revealOnEnter, revealOnScroll, ScrollTrigger } from '@/composables/useMotion'

/**
 * Browse screen on GET /quizzes/search.
 *
 * The endpoint is keyset paginated, so there are no page numbers: results grow with
 * "Load more" using the cursor the backend returns. A cursor is only valid for the
 * sort and filters it was issued for, so every filter change restarts from page one,
 * which useCursorList takes care of.
 */
const route = useRoute()
const router = useRouter()

// Sorts accepted by the endpoint. Without a keyword the backend defaults to newest,
// with one it defaults to relevance, so "Best match" is sent as an empty sort.
const SORTS = [
  { value: '', label: 'Best match' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'most_played', label: 'Most played' },
  { value: 'trending', label: 'Trending' },
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
]

const PAGE_SIZE = 24

const keyword = ref(route.query.keyword ?? '')
const category = ref(route.query.category ?? '')
const sort = ref(SORTS.some((item) => item.value === route.query.sort) ? route.query.sort : '')

// Category chips use the same static list and swatches as the home rails.

const pageEl = ref(null)
const gridEl = ref(null)
const resultsEl = ref(null)

let gridReveal = null

const list = useCursorList(
  (params) => searchQuizzes(params),
  () => ({
    keyword: keyword.value,
    category: category.value,
    sort: sort.value,
    limit: PAGE_SIZE,
  }),
  { includeTotal: true, errorFallback: 'Could not load quizzes.' },
)

const quizzes = list.items
const hasFilters = computed(() => Boolean(keyword.value || category.value || sort.value))

// Keep the URL shareable. There is no page number to carry any more.
watch([keyword, category, sort], () => {
  router.replace({
    name: 'discover',
    query: {
      keyword: keyword.value || undefined,
      category: category.value || undefined,
      sort: sort.value || undefined,
    },
  })
})

function selectCategory(value) {
  category.value = category.value === value ? '' : value
}

function clearFilters() {
  keyword.value = ''
  category.value = ''
  sort.value = ''
}

/** Appending a page keeps the results in view instead of jumping to the top. */
function loadMore() {
  list.loadMore()
}

onMounted(() => revealOnEnter(pageEl.value))

/**
 * The grid is re-keyed whenever the result set changes, so the reveal has to be
 * rebuilt against the new nodes. Old triggers are killed first, otherwise each search
 * would leave a dead batch behind and cards could stay stuck at opacity 0.
 */
watch(
  quizzes,
  async (rows) => {
    if (gridReveal) {
      gridReveal.forEach((trigger) => trigger.kill())
      gridReveal = null
    }
    if (!rows.length) return

    await nextTick()
    gridReveal = revealOnScroll(gridEl.value, '[data-reveal]', { y: 20, stagger: 0.04 })
    // Layout height changed with the new result count.
    ScrollTrigger.refresh()
  },
  { immediate: true },
)
</script>

<template>
  <div ref="pageEl" class="container-page pb-xxl pt-lg">
    <div data-enter>
      <p class="eyebrow-label">
        Browse
      </p>
      <h1 class="mt-xxs text-heading-1 text-ink">
        Discover quizzes
      </h1>
      <p class="mt-xs text-body-sm text-ink-muted">
        Search by keyword or filter by category.
      </p>
    </div>

    <div class="mt-lg flex flex-col gap-sm" data-enter>
      <div class="flex flex-wrap items-center gap-sm">
        <input
          v-model.trim="keyword"
          class="field max-w-md"
          type="search"
          placeholder="Search by keyword…"
        >
        <label class="flex items-center gap-xs text-caption text-ink-muted">
          Sort
          <select v-model="sort" class="field">
            <option v-for="item in SORTS" :key="item.value || 'default'" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </label>
      </div>

      <div class="flex flex-wrap gap-[10px]">
        <button
          v-for="item in CATEGORIES"
          :key="item.name"
          type="button"
          class="filter-chip"
          :class="category === item.name ? 'is-active' : ''"
          :aria-pressed="category === item.name"
          @click="selectCategory(item.name)"
        >
          <span class="h-[9px] w-[9px] shrink-0 rounded-full" :style="{ backgroundColor: item.color }" />
          {{ item.name }}
        </button>

        <button v-if="hasFilters" class="btn-ghost" type="button" @click="clearFilters">
          Clear
        </button>
      </div>
    </div>

    <div ref="resultsEl" class="mt-lg scroll-mt-[88px]" data-enter>
      <div class="flex items-center justify-between gap-sm">
        <p class="text-body-sm text-ink-muted">
          <template v-if="list.total.value !== null">
            {{ list.total.value }} quizzes found
          </template>
          <template v-else>
            Results
          </template>
        </p>
        <span v-if="list.loadingMore.value" class="text-caption text-ink-faint">
          Loading more…
        </span>
      </div>

      <div v-if="list.loading.value" class="mt-lg grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="n in 8"
          :key="`skeleton-${n}`"
          class="h-[300px] animate-pulse rounded-lg bg-hairline/60"
        />
      </div>

      <div v-else-if="list.errorMessage.value" class="card-surface mt-md p-xl">
        <p class="text-body-sm text-sticker-orange-deep">
          {{ list.errorMessage.value }}
        </p>
        <button class="btn-utility mt-md" type="button" @click="list.loadFirst()">
          Try again
        </button>
      </div>

      <div v-else-if="!quizzes.length" class="card-surface mt-md p-xl text-center">
        <p class="text-body-md text-ink">
          No quizzes match these filters.
        </p>
        <p class="mt-xxs text-body-sm text-ink-muted">
          Try a different keyword or clear the category.
        </p>
        <button v-if="hasFilters" class="btn-utility mt-md" type="button" @click="clearFilters">
          Clear filters
        </button>
      </div>

      <template v-else>
        <div
          ref="gridEl"
          class="mt-md grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4"
        >
          <QuizCard v-for="quiz in quizzes" :key="quiz.id" :quiz="quiz" data-reveal />
        </div>

        <div v-if="list.hasMore.value" class="mt-lg flex justify-center">
          <button
            class="btn-utility"
            type="button"
            :disabled="list.loadingMore.value"
            @click="loadMore"
          >
            {{ list.loadingMore.value ? 'Loading…' : 'Load more' }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/*
  Category chips are toggles, so they need a real pressed state. The plain .chip class
  only had a hover tint, which made the active filter hard to spot.
*/
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
