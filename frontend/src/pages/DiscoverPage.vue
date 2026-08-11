<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QuizCard from '@/components/quiz/QuizCard.vue'
import { searchQuizzes } from '@/api/quizzes.api'
import { CATEGORIES, LANGUAGES, SEARCH_SORTS } from '@/constants/quizMeta'
import { useCursorList } from '@/composables/useCursorList'
import { revealOnEnter, revealOnScroll, ScrollTrigger } from '@/composables/useMotion'

/**
 * Browse screen on GET /quizzes/search.
 *
 * Layout follows the catalog pattern used by large course marketplaces: a persistent
 * filter rail on the left and the result grid on the right, so refining a search never
 * pushes the results below the fold. Below the lg breakpoint the same rail is reused as
 * a bottom sheet opened from the "Filters" button, which keeps a single source of markup.
 *
 * The endpoint is keyset paginated, so there are no page numbers: results grow with
 * "Load more" using the cursor the backend returns. A cursor is only valid for the
 * sort and filters it was issued for, so every filter change restarts from page one,
 * which useCursorList takes care of.
 *
 * The whole filter set lives in the query string, so a search is shareable and
 * survives a reload. `include_total` is asked for on the first page only, which is
 * where the result count is rendered.
 */
const route = useRoute()
const router = useRouter()

const PAGE_SIZE = 24
const KEYWORD_DEBOUNCE = 350

function queryText(value) {
  return typeof value === 'string' ? value : ''
}

/** Keeps a sort from the URL only when the endpoint actually accepts it. */
function querySort(value) {
  return SEARCH_SORTS.some((item) => item.value === value) ? value : ''
}

// Filter state, seeded from the URL so a shared link opens on the same result set.
const keywordInput = ref(queryText(route.query.keyword))
const keyword = ref(keywordInput.value)
const language = ref(queryText(route.query.language))
const category = ref(queryText(route.query.category))
const createdFrom = ref(queryText(route.query.created_from))
const createdTo = ref(queryText(route.query.created_to))
const minQuestions = ref(queryText(route.query.min_questions))
const minPlays = ref(queryText(route.query.min_plays))
const sort = ref(querySort(route.query.sort))

const pageEl = ref(null)
const gridEl = ref(null)
const filtersOpen = ref(false)

let gridReveal = null

// Typing must not fire a request per keystroke; the committed keyword is what the
// list watches, so the cursor only resets once the user pauses.
let keywordTimer = null

watch(keywordInput, (value) => {
  window.clearTimeout(keywordTimer)
  keywordTimer = window.setTimeout(() => {
    keyword.value = value
  }, KEYWORD_DEBOUNCE)
})

const list = useCursorList(
  (params) => searchQuizzes(params),
  () => ({
    keyword: keyword.value,
    language: language.value,
    category: category.value,
    createdFrom: createdFrom.value,
    createdTo: createdTo.value,
    minQuestions: minQuestions.value,
    minPlays: minPlays.value,
    sort: sort.value,
    limit: PAGE_SIZE,
  }),
  { includeTotal: true, errorFallback: 'Could not load quizzes.' },
)

const quizzes = list.items

// Sort is a presentation choice rather than a filter, so it is counted separately and
// never shows up on the "Filters" badge.
const activeFilterCount = computed(
  () =>
    [
      language.value,
      category.value,
      createdFrom.value,
      createdTo.value,
      minQuestions.value,
      minPlays.value,
    ].filter(Boolean).length,
)

const hasFilters = computed(
  () => Boolean(keyword.value || sort.value) || activeFilterCount.value > 0,
)

// The URL mirrors the filters with the backend parameter names, so a link can be
// pasted straight into the API while debugging.
watch(
  [keyword, language, category, createdFrom, createdTo, minQuestions, minPlays, sort],
  () => {
    router.replace({
      name: 'discover',
      query: {
        keyword: keyword.value || undefined,
        language: language.value || undefined,
        category: category.value || undefined,
        created_from: createdFrom.value || undefined,
        created_to: createdTo.value || undefined,
        min_questions: minQuestions.value || undefined,
        min_plays: minPlays.value || undefined,
        sort: sort.value || undefined,
      },
    })
  },
)

function selectCategory(value) {
  category.value = category.value === value ? '' : value
}

function clearFilters() {
  keywordInput.value = ''
  keyword.value = ''
  language.value = ''
  category.value = ''
  createdFrom.value = ''
  createdTo.value = ''
  minQuestions.value = ''
  minPlays.value = ''
  sort.value = ''
}

function closeFilters() {
  filtersOpen.value = false
}

function onKeydown(event) {
  if (event.key === 'Escape') closeFilters()
}

/**
 * The sheet covers the page on small screens, so the page behind it must not scroll.
 * Lenis drives the scroll itself, so pausing it is what actually freezes the page; the
 * inline overflow lock is the fallback for the reduced-motion path where Lenis is off.
 */
watch(filtersOpen, (open) => {
  const lenis = window.__lenis

  if (open) {
    lenis?.stop()
    document.body.style.overflow = 'hidden'
    return
  }

  lenis?.start()
  document.body.style.overflow = ''
})

onMounted(() => {
  revealOnEnter(pageEl.value)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.clearTimeout(keywordTimer)
  window.removeEventListener('keydown', onKeydown)
  window.__lenis?.start()
  document.body.style.overflow = ''
})

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
        Search by keyword, then narrow the results down by category, language, date or size.
      </p>
    </div>

    <div class="mt-lg flex flex-wrap items-center gap-sm" data-enter>
      <input
        v-model.trim="keywordInput"
        class="field max-w-md"
        type="search"
        placeholder="Search by keyword…"
        aria-label="Search by keyword"
      >

      <!-- Below lg the rail is hidden, so this button is the only way into the filters. -->
      <button class="btn-utility lg:hidden" type="button" @click="filtersOpen = true">
        Filters
        <span v-if="activeFilterCount" class="filter-count">{{ activeFilterCount }}</span>
      </button>

      <label class="ml-auto flex items-center gap-xs text-caption text-ink-muted">
        Sort
        <select v-model="sort" class="field">
          <option v-for="item in SEARCH_SORTS" :key="item.value || 'default'" :value="item.value">
            {{ item.label }}
          </option>
        </select>
      </label>
    </div>

    <div class="mt-lg gap-xl lg:grid lg:grid-cols-[260px_minmax(0,1fr)]" data-enter>
      <!-- Backdrop only exists while the sheet is open on small screens. -->
      <div v-if="filtersOpen" class="filter-backdrop lg:hidden" @click="closeFilters" />

      <aside
        class="filter-panel"
        :class="filtersOpen ? 'is-open' : ''"
        aria-label="Filters"
        data-lenis-prevent
      >
        <div class="flex items-center justify-between gap-sm">
          <p class="text-title text-ink">
            Filters
          </p>
          <button class="btn-ghost lg:hidden" type="button" @click="closeFilters">
            Done
          </button>
        </div>

        <section class="filter-group">
          <p class="eyebrow-label">
            Category
          </p>
          <div class="mt-xs flex flex-col gap-xxs">
            <button
              v-for="item in CATEGORIES"
              :key="item.name"
              type="button"
              class="filter-row"
              :class="category === item.name ? 'is-active' : ''"
              :aria-pressed="category === item.name"
              @click="selectCategory(item.name)"
            >
              <span
                class="h-[9px] w-[9px] shrink-0 rounded-full"
                :style="{ backgroundColor: item.color }"
              />
              {{ item.name }}
            </button>
          </div>
        </section>

        <section class="filter-group">
          <label class="flex flex-col gap-xxs">
            <span class="eyebrow-label">Language</span>
            <select v-model="language" class="field">
              <option value="">
                Any
              </option>
              <option v-for="item in LANGUAGES" :key="item.value" :value="item.value">
                {{ item.label }}
              </option>
            </select>
          </label>
        </section>

        <!-- Advanced filters map 1:1 onto the backend query parameters. -->
        <section class="filter-group">
          <p class="eyebrow-label">
            Created
          </p>
          <div class="mt-xs flex flex-col gap-xs">
            <label class="flex flex-col gap-xxs text-caption text-ink-muted">
              From
              <input v-model="createdFrom" class="field" type="date">
            </label>
            <label class="flex flex-col gap-xxs text-caption text-ink-muted">
              To
              <input v-model="createdTo" class="field" type="date">
            </label>
          </div>
        </section>

        <section class="filter-group">
          <p class="eyebrow-label">
            Size and popularity
          </p>
          <div class="mt-xs flex flex-col gap-xs">
            <label class="flex flex-col gap-xxs text-caption text-ink-muted">
              Min questions
              <input v-model="minQuestions" class="field" type="number" min="0">
            </label>
            <label class="flex flex-col gap-xxs text-caption text-ink-muted">
              Min plays
              <input v-model="minPlays" class="field" type="number" min="0">
            </label>
          </div>
        </section>

        <button v-if="hasFilters" class="btn-utility mt-md w-full" type="button" @click="clearFilters">
          Clear all
        </button>
      </aside>

      <div class="mt-lg scroll-mt-[88px] lg:mt-0">
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

        <div v-if="list.loading.value" class="mt-md grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="n in 6"
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
            Try a different keyword or loosen the filters.
          </p>
          <button v-if="hasFilters" class="btn-utility mt-md" type="button" @click="clearFilters">
            Clear filters
          </button>
        </div>

        <template v-else>
          <div
            ref="gridEl"
            class="mt-md grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-3"
          >
            <QuizCard v-for="quiz in quizzes" :key="quiz.id" :quiz="quiz" data-reveal />
          </div>

          <div v-if="list.hasMore.value" class="mt-lg flex justify-center">
            <button
              class="btn-utility"
              type="button"
              :disabled="list.loadingMore.value"
              @click="list.loadMore()"
            >
              {{ list.loadingMore.value ? 'Loading…' : 'Load more' }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
  One markup for two shapes: a bottom sheet under lg, a sticky rail from lg up. The
  sheet stays mounted and only slides out of view, so opening it does not remount the
  inputs and lose focus.
*/
.filter-panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 70;
  max-height: 82vh;
  overflow-y: auto;
  padding: 20px;
  background-color: var(--surface);
  border-top: 1px solid var(--hairline);
  border-top-left-radius: var(--r-lg);
  border-top-right-radius: var(--r-lg);
  box-shadow: var(--shadow-1);
  transform: translateY(100%);
  visibility: hidden;
  transition: transform 220ms ease, visibility 220ms ease;
}

.filter-panel.is-open {
  transform: translateY(0);
  visibility: visible;
}

.filter-backdrop {
  position: fixed;
  inset: 0;
  z-index: 65;
  background-color: rgba(0, 0, 0, 0.35);
}

.filter-group + .filter-group {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--hairline);
}

/* Category entries are toggles, so they need a visible pressed state. */
.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border-radius: var(--r-md);
  color: var(--ink-secondary);
  font-size: 14px;
  text-align: left;
  transition: background-color 150ms ease, color 150ms ease;
}

.filter-row:hover {
  background-color: var(--canvas-soft);
}

.filter-row.is-active {
  background-color: var(--canvas-soft);
  color: var(--ink);
  font-weight: 600;
}

.filter-count {
  display: inline-grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: var(--r-full);
  background-color: var(--primary);
  color: var(--on-primary);
  font-size: 12px;
}

@media (min-width: 1024px) {
  .filter-panel {
    position: sticky;
    /* A stretched grid item is as tall as the row, which would defeat sticky. */
    align-self: start;
    /* Clears the fixed top bar. */
    top: 88px;
    z-index: 1;
    max-height: calc(100vh - 112px);
    padding: 0;
    background-color: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    transform: none;
    visibility: visible;
    transition: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .filter-panel,
  .filter-row {
    transition: none;
  }
}
</style>
