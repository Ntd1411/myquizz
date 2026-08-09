<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import QuizCard from '@/components/quiz/QuizCard.vue'
import { getQuizzesByOwner } from '@/api/quizzes.api'
import { getPublicUser } from '@/api/users.api'
import { PROFILE_SORTS } from '@/constants/quizMeta'
import { useCursorList } from '@/composables/useCursorList'
import { useAuthStore } from '@/stores/auth.store'
import { revealOnEnter, revealOnScroll, ScrollTrigger } from '@/composables/useMotion'

/**
 * Public profile of another creator.
 *
 * Two independent sources: GET /users/:id for the header and
 * GET /quizzes/users/id/:ownerId for the listing. That listing only ever returns
 * public quizzes with at least one question, so an empty result does not mean the
 * account is empty and must never be shown as "user not found" - a missing account is
 * only the header request failing.
 */
const props = defineProps({
  id: { type: String, required: true },
})

const auth = useAuthStore()

const PAGE_SIZE = 24

const pageEl = ref(null)
const gridEl = ref(null)
let gridReveal = null

const sort = ref('newest')

const ownerId = computed(() => props.id)

const profile = useQuery({
  queryKey: ['users', 'public', ownerId],
  queryFn: () => getPublicUser(ownerId.value),
  retry: false,
})

const user = computed(() => profile.data.value ?? null)

const displayName = computed(() => user.value?.fullname || user.value?.username || 'Creator')

const initial = computed(() => (displayName.value.trim()[0] || 'M').toUpperCase())

// Viewing your own profile: the public listing hides your drafts, so point at the
// library instead of leaving the page looking broken.
const isSelf = computed(() => Boolean(auth.user?.id) && auth.user.id === ownerId.value)

const list = useCursorList(
  ({ cursor, limit, includeTotal }) =>
    getQuizzesByOwner(ownerId.value, { sort: sort.value, cursor, limit, includeTotal }),
  () => ({ ownerId: ownerId.value, sort: sort.value, limit: PAGE_SIZE }),
  {
    enabled: () => Boolean(ownerId.value),
    includeTotal: true,
    errorFallback: 'Could not load these quizzes.',
  },
)

const quizzes = list.items
const total = computed(() => list.total.value ?? quizzes.value.length)

onMounted(() => revealOnEnter(pageEl.value))

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
    <!-- Header. A failing user request is the only "not found" case. -->
    <div v-if="profile.isLoading.value" class="h-[96px] animate-pulse rounded-lg bg-hairline/60" />

    <div v-else-if="profile.isError.value" class="card-surface p-xl text-center" data-enter>
      <p class="text-title text-ink">
        Creator not found
      </p>
      <p class="mx-auto mt-xs max-w-[420px] text-body-sm text-ink-muted">
        This account does not exist or is no longer active.
      </p>
      <RouterLink :to="{ name: 'discover' }" class="btn-primary mt-md">
        Discover quizzes
      </RouterLink>
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center gap-md" data-enter>
        <span class="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-hairline">
          <img
            v-if="user?.avatar"
            :src="user.avatar"
            :alt="displayName"
            class="h-full w-full object-cover"
            draggable="false"
          >
          <span v-else class="text-heading-3 text-ink-muted">
            {{ initial }}
          </span>
        </span>

        <div class="min-w-0">
          <p class="eyebrow-label">
            Creator
          </p>
          <h1 class="mt-xxs truncate text-heading-1 text-ink">
            {{ displayName }}
          </h1>
          <p class="mt-xs text-body-sm text-ink-muted">
            {{ total }} public {{ total === 1 ? 'quiz' : 'quizzes' }}
          </p>
        </div>

        <RouterLink v-if="isSelf" :to="{ name: 'library' }" class="btn-utility ml-auto">
          Manage my library
        </RouterLink>
      </div>

      <div class="mt-lg flex flex-wrap items-center justify-between gap-sm" data-enter>
        <h2 class="section-title">
          Quizzes
        </h2>
        <label class="flex items-center gap-xs text-caption text-ink-muted">
          Sort
          <select v-model="sort" class="field">
            <option v-for="item in PROFILE_SORTS" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </label>
      </div>

      <div v-if="list.loading.value" class="mt-md grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="n in 8"
          :key="`skeleton-${n}`"
          class="h-[300px] animate-pulse rounded-lg bg-hairline/60"
        />
      </div>

      <div v-else-if="list.errorMessage.value" class="card-surface mt-md p-lg">
        <p class="text-body-sm text-sticker-orange-deep">
          {{ list.errorMessage.value }}
        </p>
        <button class="btn-utility mt-md" type="button" @click="list.loadFirst()">
          Try again
        </button>
      </div>

      <!-- Empty listing, not a missing account: the endpoint hides drafts and private quizzes. -->
      <div v-else-if="!quizzes.length" class="card-surface mt-md p-xl text-center">
        <p class="text-title text-ink">
          No public quizzes yet
        </p>
        <p class="mx-auto mt-xs max-w-[440px] text-body-sm text-ink-muted">
          {{
            isSelf
              ? 'Your private quizzes and quizzes without questions are only visible in your library.'
              : 'This creator has not published anything yet.'
          }}
        </p>
      </div>

      <template v-else>
        <div ref="gridEl" class="mt-md grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
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
    </template>
  </div>
</template>
