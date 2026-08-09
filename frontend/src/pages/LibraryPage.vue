<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import QuizCard from '@/components/quiz/QuizCard.vue'
import { getMyQuizzes } from '@/api/quizzes.api'
import { useCursorList } from '@/composables/useCursorList'
import { useAuthStore } from '@/stores/auth.store'
import { revealOnEnter, revealOnScroll, ScrollTrigger } from '@/composables/useMotion'

/**
 * "My library" reads GET /quizzes/me, the only listing that returns the signed-in
 * user's private quizzes and quizzes without questions. The public profile listing
 * would hide exactly those, so the owner-profile endpoint is the wrong source here.
 *
 * Pagination is keyset based: the first page is loaded automatically, further pages
 * are appended with the cursor the backend returns.
 */
const auth = useAuthStore()

const PAGE_SIZE = 24

const pageEl = ref(null)
const gridEl = ref(null)
let gridReveal = null

const list = useCursorList(
  (params) => getMyQuizzes(params),
  () => ({ sort: 'recently_updated', limit: PAGE_SIZE }),
  {
    enabled: () => Boolean(auth.user?.id),
    includeTotal: true,
    errorFallback: 'Could not load your quizzes.',
  },
)

const quizzes = list.items
const total = computed(() => list.total.value ?? quizzes.value.length)

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
          {{ total }} {{ total === 1 ? 'quiz' : 'quizzes' }} you created.
        </p>
      </div>
      <RouterLink :to="{ name: 'create-start' }" class="btn-primary">
        Create a quiz
      </RouterLink>
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
</template>
