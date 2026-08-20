<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QuizCard from '@/components/quiz/QuizCard.vue'
import { searchQuizzes } from '@/api/quizzes.api'
import { LANGUAGES, SEARCH_SORTS } from '@/constants/quizMeta'
import { useCursorList } from '@/composables/useCursorList'
import { useAuthStore } from '@/stores/auth.store'
import { revealAppended, revealOnEnter, ScrollTrigger } from '@/composables/useMotion'
import StateBlock from '@/components/base/StateBlock.vue'
import SkeletonBlock from '@/components/base/SkeletonBlock.vue'

/**
 * Browse screen on GET /quizzes/search.
 *
 * Layout follows the catalog pattern used by large course marketplaces: a persistent
 * filter rail on the left and the result grid on the right, so refining a search never
 * pushes the results below the fold. Below the lg breakpoint the same rail is reused as
 * a bottom sheet opened from the "Filters" button, which keeps a single source of markup.
 *
 * There is no search box on this page. The keyword belongs to the top bar, which writes
 * it into the URL; this screen only reads it back, so the product can never end up with
 * two search fields holding two different keywords.
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
const auth = useAuthStore()

const PAGE_SIZE = 24

function queryText(value) {
  return typeof value === 'string' ? value : ''
}

/** Keeps a sort from the URL only when the endpoint actually accepts it. */
function querySort(value) {
  return SEARCH_SORTS.some((item) => item.value === value) ? value : ''
}

// Filter state, seeded from the URL so a shared link opens on the same result set.
const keyword = ref(queryText(route.query.keyword))
const language = ref(queryText(route.query.language))
const category = ref(queryText(route.query.category))
const createdFrom = ref(queryText(route.query.created_from))
const createdTo = ref(queryText(route.query.created_to))
const minQuestions = ref(queryText(route.query.min_questions))
const minPlays = ref(queryText(route.query.min_plays))
// `mine` narrows a search to quizzes owned by the caller and nothing else; the caller's
// private and still empty quizzes come along because they are theirs. The backend rejects
// it for anonymous callers, so it is only ever sent while signed in.
const mine = ref(route.query.mine === 'true')
const sort = ref(querySort(route.query.sort))

const pageEl = ref(null)
const gridEl = ref(null)
const filtersOpen = ref(false)

// One kill handle per revealed page, released together when the page unmounts.
const gridReveals = []

/*
  Groups open collapsed so the rail stays short enough to read at a glance. A group the
  URL already carries a value for is the exception, otherwise an incoming link would
  hide the very filters it applied. Read once on purpose: these are plain booleans, not
  computeds, so the group never snaps shut under the reader while they are inside it.
*/
const initiallyOpen = {
  language: Boolean(language.value),
  created: Boolean(createdFrom.value || createdTo.value),
  size: Boolean(minQuestions.value || minPlays.value),
  ownership: mine.value,
}

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
    mine: auth.isLoggedIn && mine.value,
    sort: sort.value,
    limit: PAGE_SIZE,
  }),
  { includeTotal: true, errorFallback: 'Could not load quizzes.' },
)

const quizzes = list.items

// Summaries shown on a collapsed group, so its value is readable without opening it.
const languageLabel = computed(
  () => LANGUAGES.find((item) => item.value === language.value)?.label ?? 'Any',
)

const createdLabel = computed(() => {
  if (createdFrom.value && createdTo.value) return `${createdFrom.value} \u2192 ${createdTo.value}`
  if (createdFrom.value) return `From ${createdFrom.value}`
  if (createdTo.value) return `Until ${createdTo.value}`
  return 'Any time'
})

const sizeLabel = computed(() => {
  const parts = []
  if (minQuestions.value) parts.push(`${minQuestions.value}+ questions`)
  if (minPlays.value) parts.push(`${minPlays.value}+ plays`)
  return parts.length ? parts.join(', ') : 'Any size'
})

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
      mine.value,
    ].filter(Boolean).length,
)

const hasFilters = computed(
  () => Boolean(keyword.value || sort.value) || activeFilterCount.value > 0,
)

/**
 * With the groups collapsed the rail no longer shows what is active, so everything in
 * effect is repeated above the results as removable chips. The keyword is included:
 * it is set from the top bar, which scrolls away, and this is the only place on the
 * page that can drop it again.
 */
const activeChips = computed(() => {
  const chips = []

  if (keyword.value) {
    chips.push({ key: 'keyword', label: `\u201C${keyword.value}\u201D`, clear: () => (keyword.value = '') })
  }
  if (category.value) {
    chips.push({ key: 'category', label: category.value, clear: () => (category.value = '') })
  }
  if (language.value) {
    chips.push({ key: 'language', label: languageLabel.value, clear: () => (language.value = '') })
  }
  if (createdFrom.value) {
    chips.push({ key: 'created-from', label: `From ${createdFrom.value}`, clear: () => (createdFrom.value = '') })
  }
  if (createdTo.value) {
    chips.push({ key: 'created-to', label: `Until ${createdTo.value}`, clear: () => (createdTo.value = '') })
  }
  if (minQuestions.value) {
    chips.push({ key: 'min-questions', label: `${minQuestions.value}+ questions`, clear: () => (minQuestions.value = '') })
  }
  if (minPlays.value) {
    chips.push({ key: 'min-plays', label: `${minPlays.value}+ plays`, clear: () => (minPlays.value = '') })
  }
  if (mine.value) {
    chips.push({ key: 'mine', label: 'Only my quizzes', clear: () => (mine.value = false) })
  }

  return chips
})

// The URL mirrors the filters with the backend parameter names, so a link can be
// pasted straight into the API while debugging.
watch(
  [keyword, language, category, createdFrom, createdTo, minQuestions, minPlays, mine, sort],
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
        mine: mine.value ? 'true' : undefined,
        sort: sort.value || undefined,
      },
    })
  },
)

// The top bar writes its keyword straight into the URL, so the URL is what this page
// listens to. The replace above re-emits the same value, which resolves to a no-op.
watch(
  () => queryText(route.query.keyword),
  (value) => {
    keyword.value = value
  },
)

function clearFilters() {
  keyword.value = ''
  language.value = ''
  category.value = ''
  createdFrom.value = ''
  createdTo.value = ''
  minQuestions.value = ''
  minPlays.value = ''
  mine.value = false
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
  window.removeEventListener('keydown', onKeydown)
  gridReveals.forEach((kill) => kill())
  window.__lenis?.start()
  document.body.style.overflow = ''
})

/**
 * "Load more" appends into the same grid, so only the cards that are actually new may
 * be touched. Re-running the reveal across the whole grid hid the results the reader
 * had already scrolled past, and they never came back: their trigger start sits behind
 * the scroll position, so the enter callback that fades them in never runs again.
 *
 * A new search replaces the nodes rather than appending to them, so those arrive
 * unstamped and animate as usual.
 */
watch(
  quizzes,
  async (rows) => {
    if (!rows.length) return

    await nextTick()
    gridReveals.push(revealAppended(gridEl.value, '[data-reveal-card]', { y: 16, stagger: 0.04 }))
    // Layout height changed with the new result count.
    ScrollTrigger.refresh()
  },
  { immediate: true },
)
</script>

<template>
  <div ref="pageEl" class="container-page pb-xxl pt-lg">
    <div class="flex flex-wrap items-end justify-between gap-md" data-enter>
      <div class="min-w-0">
        <h1 class="truncate text-heading-3 text-ink">
          <template v-if="keyword">
            Results for “{{ keyword }}”
          </template>
          <template v-else>
            All quizzes
          </template>
        </h1>
        <p class="mt-xxs text-body-sm text-ink-2">
          <template v-if="keyword">
            Matched on title and description. Search again from the bar above to change it.
          </template>
          <template v-else>
            Everything the community has published, newest first until you pick a sort.
          </template>
        </p>
      </div>

      <div class="flex items-center gap-sm">
        <!-- Below lg the rail is hidden, so this button is the only way into the filters. -->
        <button class="btn-utility lg:hidden" type="button" @click="filtersOpen = true">
          Filters
          <span v-if="activeFilterCount" class="filter-count">{{ activeFilterCount }}</span>
        </button>

        <label class="flex items-center gap-xs text-caption text-ink-2">
          Sort
          <select v-model="sort" class="field">
            <option v-for="item in SEARCH_SORTS" :key="item.value || 'default'" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </label>
      </div>
    </div>

    <!-- The groups are collapsed, so what is currently in effect is summarised here. -->
    <div v-if="activeChips.length" class="mt-md flex flex-wrap items-center gap-xs">
      <button
        v-for="chip in activeChips"
        :key="chip.key"
        class="chip is-active"
        type="button"
        @click="chip.clear()"
      >
        {{ chip.label }}
        <span aria-hidden="true">×</span>
        <span class="sr-only">Remove this filter</span>
      </button>
    </div>

    <div class="mt-lg gap-xl lg:grid lg:grid-cols-[260px_minmax(0,1fr)]" data-enter>
      <!-- Backdrop only exists while the sheet is open on small screens. -->
      <div v-if="filtersOpen" class="filter-backdrop lg:hidden" @click="closeFilters" />

      <aside
        class="filter-panel scroll-slim"
        :class="filtersOpen ? 'is-open' : ''"
        aria-label="Filters"
        data-lenis-prevent
      >
        <div class="filter-head">
          <p class="text-title text-ink">
            Filters
          </p>
          <div class="flex items-center gap-xxs">
            <!--
              Kept mounted and only made invisible. Unmounting it changed the height of
              the whole rail the moment the first filter was applied.
            -->
            <button
              class="icon-btn"
              :class="hasFilters ? '' : 'invisible'"
              type="button"
              :disabled="!hasFilters"
              title="Clear all filters"
              aria-label="Clear all filters"
              @click="clearFilters"
            >
              <svg
                class="h-[17px] w-[17px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>

            <button
              class="icon-btn lg:hidden"
              type="button"
              title="Close filters"
              aria-label="Close filters"
              @click="closeFilters"
            >
              <svg
                class="h-[18px] w-[18px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        <details class="filter-group" :open="initiallyOpen.language">
          <summary class="filter-summary">
            <span class="eyebrow-label">Language</span>
            <span class="filter-value" :class="language ? 'is-set' : ''">{{ languageLabel }}</span>
            <svg
              class="filter-chevron"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <div class="filter-body">
            <select v-model="language" class="field" aria-label="Language">
              <option value="">
                Any
              </option>
              <option v-for="item in LANGUAGES" :key="item.value" :value="item.value">
                {{ item.label }}
              </option>
            </select>
          </div>
        </details>

        <!-- Advanced filters map 1:1 onto the backend query parameters. -->
        <details class="filter-group" :open="initiallyOpen.created">
          <summary class="filter-summary">
            <span class="eyebrow-label">Created</span>
            <span class="filter-value" :class="createdFrom || createdTo ? 'is-set' : ''">{{ createdLabel }}</span>
            <svg
              class="filter-chevron"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <div class="filter-body flex flex-col gap-xs">
            <label class="flex flex-col gap-xxs text-caption text-ink-2">
              From
              <input v-model="createdFrom" class="field" type="date">
            </label>
            <label class="flex flex-col gap-xxs text-caption text-ink-2">
              To
              <input v-model="createdTo" class="field" type="date">
            </label>
          </div>
        </details>

        <details class="filter-group" :open="initiallyOpen.size">
          <summary class="filter-summary">
            <span class="eyebrow-label">Size and plays</span>
            <span class="filter-value" :class="minQuestions || minPlays ? 'is-set' : ''">{{ sizeLabel }}</span>
            <svg
              class="filter-chevron"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <div class="filter-body flex flex-col gap-xs">
            <label class="flex flex-col gap-xxs text-caption text-ink-2">
              Min questions
              <input v-model="minQuestions" class="field" type="number" min="0">
            </label>
            <label class="flex flex-col gap-xxs text-caption text-ink-2">
              Min plays
              <input v-model="minPlays" class="field" type="number" min="0">
            </label>
          </div>
        </details>

        <!-- Narrowing a search to one author is only offered for the signed-in author. -->
        <details v-if="auth.isLoggedIn" class="filter-group" :open="initiallyOpen.ownership">
          <summary class="filter-summary">
            <span class="eyebrow-label">Ownership</span>
            <span class="filter-value" :class="mine ? 'is-set' : ''">{{ mine ? 'Mine only' : 'Everyone' }}</span>
            <svg
              class="filter-chevron"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <div class="filter-body">
            <label class="flex items-center gap-xs text-body-sm text-ink-2">
              <input v-model="mine" type="checkbox" class="h-[16px] w-[16px] accent-spotlight">
              Only show my quizzes
            </label>
          </div>
        </details>
      </aside>

      <div class="mt-lg scroll-mt-[88px] lg:mt-0">
        <div class="flex items-center justify-between gap-sm">
          <p class="text-body-sm text-ink-2">
            <template v-if="list.total.value !== null">
              {{ list.total.value }} quizzes found
            </template>
            <template v-else>
              Results
            </template>
          </p>
          <span v-if="list.loadingMore.value" class="text-caption text-ink-3">
            Loading more…
          </span>
        </div>

        <div v-if="list.loading.value" class="mt-md grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-3">
          <SkeletonBlock
            v-for="n in 6"
            :key="`skeleton-${n}`"
            :rows="1"
            height="h-[300px]"
            card
          />
        </div>

        <div v-else-if="list.errorMessage.value" class="card-surface mt-md">
          <StateBlock
            variant="error"
            :icon="'\u{26A0}\u{FE0F}'"
            title="Could not load quizzes"
            :message="list.errorMessage.value"
            action-label="Try again"
            @action="list.loadFirst()"
          />
        </div>

        <div v-else-if="!quizzes.length" class="card-surface mt-md">
          <StateBlock
            :icon="'\u{1F50D}'"
            title="No quizzes match these filters"
            message="Try another keyword in the bar above, or loosen the filters."
            :action-label="hasFilters ? 'Clear filters' : ''"
            @action="clearFilters"
          />
        </div>

        <template v-else>
          <div
            ref="gridEl"
            class="mt-md grid grid-cols-1 gap-md sm:grid-cols-2 xl:grid-cols-3"
          >
            <QuizCard v-for="quiz in quizzes" :key="quiz.id" :quiz="quiz" data-reveal-card />
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
  /*
    Only the block axis ever scrolls. A horizontal bar would eat height off the panel,
    which can be enough to demand a vertical bar, which narrows the panel and asks for
    the horizontal one again.
  */
  overflow-x: hidden;
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

/* Height is pinned to the icon buttons, so showing or hiding one cannot move the rail. */
.filter-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 34px;
}

/*
  Every group carries its own top rule, the first one included, so the "Filters"
  heading stays separated from the controls under it even when the group right below
  is conditional and not rendered.
*/
.filter-group {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--hairline);
}

/*
  Native <details> carries the open state, which keeps it out of the component state
  and means a group cannot be reset by a re-render of the results.
*/
.filter-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  list-style: none;
  user-select: none;
  /*
    Clips the chevron while it turns. Layout measures a rotated element by its bounding
    box, which is at its largest halfway through the turn: a 15px square spans about
    21px at 45 degrees. The last group's chevron therefore reaches roughly three pixels
    below the panel for the 220ms the turn lasts, which is scrollable overflow, so the
    scrollbar appears and leaves again on every single toggle. Clipping here keeps that
    bounding box out of the panel's overflow. The glyph is drawn well inside its own box
    (its furthest point is about 4px from the centre of a 15px square), so it stays whole
    at every angle.
  */
  overflow: hidden;
}

/* Safari draws its own triangle unless this pseudo-element is removed. */
.filter-summary::-webkit-details-marker {
  display: none;
}

.filter-value {
  margin-left: auto;
  overflow: hidden;
  max-width: 130px;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--ink-3);
}

.filter-value.is-set {
  color: var(--spotlight);
  font-weight: 600;
}

.filter-chevron {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  color: var(--ink-3);
  transition: transform var(--t-ui) var(--ease);
}

.filter-group[open] > .filter-summary .filter-chevron {
  transform: rotate(180deg);
}

.filter-body {
  padding-top: 12px;
  animation: filter-open 200ms var(--ease);
}

@keyframes filter-open {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.filter-count {
  display: inline-grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: var(--r-full);
  background-color: var(--spotlight);
  color: #ffffff;
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
    padding: 0 4px 0 0;
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
  .filter-panel {
    transition: none;
  }

  .filter-body {
    animation: none;
  }
}
</style>
