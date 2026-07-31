<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import QuizCard from '@/components/quiz/QuizCard.vue'
import { getQuizzesByOwner } from '@/api/quizzes.api'
import { toErrorMessage } from '@/api/envelope'
import { useAuthStore } from '@/stores/auth.store'
import { revealOnEnter, revealOnScroll, ScrollTrigger } from '@/composables/useMotion'

/**
 * "My library" always talks to the real backend (GET /quizzes/users/id/:ownerId).
 * Mock data is only used for the public browse pages; here it would hide the
 * quizzes the account actually owns.
 */
const auth = useAuthStore()

const pageEl = ref(null)
const gridEl = ref(null)
let gridReveal = null

const query = useQuery({
  queryKey: computed(() => ['quizzes', 'owner', auth.user?.id]),
  queryFn: () => getQuizzesByOwner(auth.user.id, { page: 1, limit: 20 }),
  enabled: computed(() => Boolean(auth.user?.id)),
})

const quizzes = computed(() => query.data.value?.quizzes ?? [])
const total = computed(() => query.data.value?.pagination?.total ?? quizzes.value.length)
const errorMessage = computed(() =>
  query.isError.value ? toErrorMessage(query.error.value, 'Could not load your quizzes.') : '',
)

onMounted(() => revealOnEnter(pageEl.value))

// Cards only exist once the query resolves, so the scroll reveal is built afterwards
// and rebuilt if the list is refetched.
watch(quizzes, async (list) => {
  if (gridReveal) {
    gridReveal.forEach((trigger) => trigger.kill())
    gridReveal = null
  }
  if (!list.length) return

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
      v-if="query.isLoading.value"
      class="mt-lg grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4"
      data-enter
    >
      <div
        v-for="n in 8"
        :key="`skeleton-${n}`"
        class="h-[300px] animate-pulse rounded-lg bg-hairline/60"
      />
    </div>

    <div v-else-if="errorMessage" class="card-surface mt-lg p-lg" data-enter>
      <p class="text-body-sm text-ink">
        {{ errorMessage }}
      </p>
      <button class="btn-utility mt-md" type="button" @click="query.refetch()">
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

    <div v-else ref="gridEl" class="mt-lg grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
      <QuizCard v-for="quiz in quizzes" :key="quiz.id" :quiz="quiz" data-reveal />
    </div>
  </div>
</template>
