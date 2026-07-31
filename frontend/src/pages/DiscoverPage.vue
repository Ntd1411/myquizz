<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import QuizCard from '@/components/quiz/QuizCard.vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import { searchQuizzes } from '@/api/quizzes.api'
import { mockCategories } from '@/api/mock.api'
import { toErrorMessage } from '@/api/envelope'
import { revealOnEnter, revealOnScroll, ScrollTrigger } from '@/composables/useMotion'

const route = useRoute()
const router = useRouter()

const keyword = ref(route.query.keyword ?? '')
const category = ref(route.query.category ?? '')
const page = ref(Number(route.query.page ?? 1))

// Backend caps limit at 20.
const LIMIT = 12

// Same category list and sticker swatches as the home rails.
const CATEGORIES = mockCategories

const pageEl = ref(null)
const gridEl = ref(null)
const resultsEl = ref(null)

let gridReveal = null

const query = useQuery({
  queryKey: computed(() => ['quizzes', 'search', keyword.value, category.value, page.value]),
  queryFn: () =>
    searchQuizzes({ keyword: keyword.value, category: category.value, page: page.value, limit: LIMIT }),
  placeholderData: keepPreviousData,
})

const quizzes = computed(() => query.data.value?.quizzes ?? [])
const pagination = computed(() => query.data.value?.pagination)
const hasFilters = computed(() => Boolean(keyword.value || category.value))

// Keep the URL shareable.
watch([keyword, category, page], () => {
  router.replace({
    name: 'discover',
    query: {
      keyword: keyword.value || undefined,
      category: category.value || undefined,
      page: page.value > 1 ? page.value : undefined,
    },
  })
})

// Any filter change must restart pagination.
watch([keyword, category], () => {
  page.value = 1
})

function selectCategory(value) {
  category.value = category.value === value ? '' : value
}

function clearFilters() {
  keyword.value = ''
  category.value = ''
}

/** Paging keeps the results in view instead of leaving the user at the page bottom. */
function goToPage(next) {
  page.value = next
  const target = resultsEl.value
  if (!target) return
  if (window.__lenis) window.__lenis.scrollTo(target, { offset: -88, duration: 1 })
  else target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(() => revealOnEnter(pageEl.value))

/**
 * The grid is re-keyed on every filter or page change, so the reveal has to be rebuilt
 * against the new nodes. Old triggers are killed first, otherwise each search would
 * leave a dead batch behind and cards could stay stuck at opacity 0.
 */
watch(
  quizzes,
  async (list) => {
    if (gridReveal) {
      gridReveal.forEach((trigger) => trigger.kill())
      gridReveal = null
    }
    if (!list.length) return

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
      <p class="eyebrow-label">Browse</p>
      <h1 class="mt-xxs text-heading-1 text-ink">Discover quizzes</h1>
      <p class="mt-xs text-body-sm text-ink-muted">
        Search by keyword or filter by category.
      </p>
    </div>

    <div class="mt-lg flex flex-col gap-sm" data-enter>
      <input
        v-model.trim="keyword"
        class="field max-w-md"
        type="search"
        placeholder="Search by keyword…"
      />

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
          <span class="h-[9px] w-[9px] shrink-0 rounded-full" :style="{ backgroundColor: item.color }"></span>
          {{ item.name }}
        </button>

        <button v-if="hasFilters" class="btn-ghost" type="button" @click="clearFilters">Clear</button>
      </div>
    </div>

    <div ref="resultsEl" class="mt-lg scroll-mt-[88px]" data-enter>
      <div class="flex items-center justify-between gap-sm">
        <p class="text-body-sm text-ink-muted">
          <template v-if="pagination">{{ pagination.total }} quizzes found</template>
          <template v-else>Results</template>
        </p>
        <!-- Refetching a cached page keeps the old cards on screen, so it needs its own hint. -->
        <span v-if="query.isFetching.value && !query.isLoading.value" class="text-caption text-ink-faint">
          Updating…
        </span>
      </div>

      <div v-if="query.isLoading.value" class="mt-lg grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="n in 8"
          :key="`skeleton-${n}`"
          class="h-[300px] animate-pulse rounded-lg bg-hairline/60"
        ></div>
      </div>

      <div v-else-if="query.isError.value" class="card-surface mt-md p-xl">
        <p class="text-body-sm text-sticker-orange-deep">
          {{ toErrorMessage(query.error.value, 'Could not load quizzes.') }}
        </p>
        <button class="btn-utility mt-md" type="button" @click="query.refetch()">Try again</button>
      </div>

      <div v-else-if="!quizzes.length" class="card-surface mt-md p-xl text-center">
        <p class="text-body-md text-ink">No quizzes match these filters.</p>
        <p class="mt-xxs text-body-sm text-ink-muted">Try a different keyword or clear the category.</p>
        <button v-if="hasFilters" class="btn-utility mt-md" type="button" @click="clearFilters">
          Clear filters
        </button>
      </div>

      <div
        v-else
        ref="gridEl"
        class="mt-md grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4"
        :class="query.isFetching.value ? 'opacity-70 transition-opacity' : 'transition-opacity'"
      >
        <QuizCard v-for="quiz in quizzes" :key="quiz.id" :quiz="quiz" data-reveal />
      </div>

      <div v-if="pagination && pagination.totalPages > 1" class="mt-lg flex items-center justify-center gap-sm">
        <button
          class="btn-utility"
          type="button"
          :disabled="!pagination.hasPreviousPage"
          @click="goToPage(page - 1)"
        >
          Previous
        </button>
        <span class="text-caption text-ink-muted">
          Page {{ pagination.page }} of {{ pagination.totalPages }}
        </span>
        <button
          class="btn-utility"
          type="button"
          :disabled="!pagination.hasNextPage"
          @click="goToPage(page + 1)"
        >
          Next
        </button>
      </div>
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
