<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import QuizCard from '@/components/quiz/QuizCard.vue'
import { getMyQuizzes, deleteQuiz } from '@/api/quizzes.api'
import { LIBRARY_SORTS } from '@/constants/quizMeta'
import { useCursorList } from '@/composables/useCursorList'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { revealOnEnter, revealOnScroll, ScrollTrigger } from '@/composables/useMotion'

/**
 * "My library" reads GET /quizzes/me, the only listing that returns the signed-in
 * user's private quizzes and quizzes without questions. The public profile listing
 * would hide exactly those, so the owner-profile endpoint is the wrong source here.
 *
 * Pagination is keyset based: the first page is loaded automatically, further pages
 * are appended with the cursor the backend returns. Filtering and sorting happen on
 * the server, because a cursor page only covers a slice of the library.
 */
const auth = useAuthStore()
const ui = useUiStore()

const PAGE_SIZE = 24
const KEYWORD_DEBOUNCE = 350

const VISIBILITIES = [
  { value: 'all', label: 'All' },
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
]

const pageEl = ref(null)
const gridEl = ref(null)
let gridReveal = null

const keywordInput = ref('')
const keyword = ref('')
const visibility = ref('all')
const sort = ref('recently_updated')
const deletingId = ref('')

// Typing must not fire a request per keystroke: the committed keyword is what the list
// watches, so the cursor only resets once the user pauses.
let keywordTimer = null

watch(keywordInput, (value) => {
  window.clearTimeout(keywordTimer)
  keywordTimer = window.setTimeout(() => {
    keyword.value = value
  }, KEYWORD_DEBOUNCE)
})

onBeforeUnmount(() => window.clearTimeout(keywordTimer))

const list = useCursorList(
  (params) => getMyQuizzes(params),
  () => ({
    keyword: keyword.value,
    visibility: visibility.value,
    sort: sort.value,
    limit: PAGE_SIZE,
  }),
  {
    enabled: () => Boolean(auth.user?.id),
    includeTotal: true,
    errorFallback: 'Could not load your quizzes.',
  },
)

const quizzes = list.items
const total = computed(() => list.total.value ?? quizzes.value.length)

const hasFilters = computed(() => Boolean(keyword.value) || visibility.value !== 'all')

function clearFilters() {
  keywordInput.value = ''
  keyword.value = ''
  visibility.value = 'all'
}

/**
 * Deleting is irreversible on the backend, so it goes through a confirmation. After a
 * successful delete the list is reloaded from the first page instead of splicing the
 * row out locally: the following cursor pages shift by one, so a local removal would
 * make "Load more" skip a quiz.
 */
async function removeQuiz(quiz) {
  if (deletingId.value) return
  if (!window.confirm(`Delete "${quiz.title}"? This cannot be undone.`)) return

  deletingId.value = quiz.id
  try {
    await deleteQuiz(quiz.id)
    ui.toast('Quiz deleted.', 'success')
    await list.loadFirst()
  } catch (error) {
    ui.toast(error?.message || 'Could not delete this quiz.', 'error')
  } finally {
    deletingId.value = ''
  }
}

onMounted(() => revealOnEnter(pageEl.value))

// Cards only exist once the first page resolves, so the scroll reveal is built
// afterwards and rebuilt whenever the list changes.
watch(quizzes, async (rows) => {
  if (gridReveal) {
    gridReveal.forEach((trigger) => trigger.kill())
    gridReveal = null
  }
  if (!rows.length) return

  await nextTick()
  gridReveal = revealOnScroll(gridEl.value, '[data-reveal]', { y: 20, stagger: 0.04 })
  ScrollTrigger.refresh()
})
</script>

<template>
  <div ref="pageEl" class="container-page pb-xxl pt-lg">
    <div class="flex flex-wrap items-end justify-between gap-sm" data-enter>
      <div>
        <p class="eyebrow-label">
          Your work
        </p>
        <h1 class="mt-xxs text-heading-1 text-ink">
          My library
        </h1>
        <p class="mt-xs text-body-sm text-ink-muted">
          {{ total }} {{ total === 1 ? 'quiz' : 'quizzes' }}{{ hasFilters ? ' match these filters.' : ' you created.' }}
        </p>
      </div>
      <RouterLink :to="{ name: 'create-start' }" class="btn-primary">
        Create a quiz
      </RouterLink>
    </div>

    <div class="mt-lg flex flex-wrap items-center gap-sm" data-enter>
      <input
        v-model.trim="keywordInput"
        class="field max-w-sm"
        type="search"
        placeholder="Search your quizzes…"
        aria-label="Search your quizzes"
      >

      <div class="flex gap-[8px]" role="group" aria-label="Visibility">
        <button
          v-for="item in VISIBILITIES"
          :key="item.value"
          type="button"
          class="filter-chip"
          :class="visibility === item.value ? 'is-active' : ''"
          :aria-pressed="visibility === item.value"
          @click="visibility = item.value"
        >
          {{ item.label }}
        </button>
      </div>

      <label class="flex items-center gap-xs text-caption text-ink-muted">
        Sort
        <select v-model="sort" class="field">
          <option v-for="item in LIBRARY_SORTS" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
        </select>
      </label>

      <button v-if="hasFilters" class="btn-ghost" type="button" @click="clearFilters">
        Clear filters
      </button>
    </div>

    <div
      v-if="list.loading.value"
      class="mt-lg grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4"
      data-enter
    >
      <div
        v-for="n in 8"
        :key="`skeleton-${n}`"
        class="h-[300px] animate-pulse rounded-lg bg-hairline/60"
      />
    </div>

    <div v-else-if="list.errorMessage.value" class="card-surface mt-lg p-lg" data-enter>
      <p class="text-body-sm text-ink">
        {{ list.errorMessage.value }}
      </p>
      <button class="btn-utility mt-md" type="button" @click="list.loadFirst()">
        Try again
      </button>
    </div>

    <!-- An empty library and an empty filter result need different exits. -->
    <div v-else-if="!quizzes.length && hasFilters" class="card-surface mt-lg p-xl text-center" data-enter>
      <p class="text-title text-ink">
        No matches
      </p>
      <p class="mx-auto mt-xs max-w-[420px] text-body-sm text-ink-muted">
        No quiz in your library matches these filters.
      </p>
      <button class="btn-utility mt-md" type="button" @click="clearFilters">
        Clear filters
      </button>
    </div>

    <div v-else-if="!quizzes.length" class="card-surface mt-lg p-xl text-center" data-enter>
      <p class="text-title text-ink">
        Nothing here yet
      </p>
      <p class="mx-auto mt-xs max-w-[420px] text-body-sm text-ink-muted">
        Build your first quiz from scratch, or import questions from text, CSV or JSON.
      </p>
      <RouterLink :to="{ name: 'create-start' }" class="btn-primary mt-md">
        Create a quiz
      </RouterLink>
    </div>

    <template v-else>
      <div ref="gridEl" class="mt-lg grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
        <QuizCard
          v-for="quiz in quizzes"
          :key="quiz.id"
          :quiz="quiz"
          show-owner-badges
          data-reveal
        >
          <template #actions>
            <RouterLink
              :to="{ name: 'edit-quiz', params: { id: quiz.id } }"
              class="card-action"
              :title="`Edit ${quiz.title}`"
            >
              Edit
            </RouterLink>
            <button
              type="button"
              class="card-action card-action-danger"
              :disabled="deletingId === quiz.id"
              :title="`Delete ${quiz.title}`"
              @click="removeQuiz(quiz)"
            >
              {{ deletingId === quiz.id ? 'Deleting…' : 'Delete' }}
            </button>
          </template>
        </QuizCard>
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
</template>

<style scoped>
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
    color 150ms ease;
}

.filter-chip:hover {
  background-color: var(--canvas-soft);
}

.filter-chip.is-active {
  border-color: var(--ink);
  color: var(--ink);
  font-weight: 600;
}

/* Owner actions sit on top of the cover, so they need their own contrast. */
.card-action {
  border-radius: var(--r-full);
  background-color: rgba(255, 255, 255, 0.94);
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
  transition: background-color 150ms ease;
}

.card-action:hover {
  background-color: #fff;
}

.card-action:disabled {
  opacity: 0.6;
}

.card-action-danger:hover {
  color: var(--sticker-orange-deep, #b23c00);
}

@media (prefers-reduced-motion: reduce) {
  .filter-chip,
  .card-action {
    transition: none;
  }
}
</style>
