<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import QuizCard from '@/components/quiz/QuizCard.vue'
import UserAvatar from '@/components/base/UserAvatar.vue'
import { getMyQuizzes, deleteQuiz } from '@/api/quizzes.api'
import { getPublicUser } from '@/api/users.api'
import { toErrorMessage } from '@/api/envelope'
import { LIBRARY_SORTS } from '@/constants/quizMeta'
import { groupDigits, formatCount } from '@/utils/formatNumber'
import { useCursorList } from '@/composables/useCursorList'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { revealOnEnter, revealAppended, ScrollTrigger } from '@/composables/useMotion'

/**
 * "My library" reads two independent endpoints, and both requests leave in the same
 * tick: neither one awaits the other, so the page costs one round trip, not two.
 *
 *   GET /quizzes/me  -> the listing, through useCursorList
 *   GET /users/:id   -> the author card, through vue-query
 *
 * GET /quizzes/me is the only listing that returns the signed-in user's private
 * quizzes and quizzes without questions. The public profile listing would hide exactly
 * those, so the owner-profile endpoint is the wrong source for the rows here - it is
 * only asked for the author.
 *
 * Where each field of the author card comes from:
 *   GET /users/:id  -> id, fullname, email, avatar, description. This is the row every
 *                      card links to, so the header shows exactly what a visitor sees.
 *   session row     -> created_at, role, auth_provider. The public endpoint strips
 *                      them on purpose, and asking /users/me again would be a third
 *                      request for data the store already holds.
 *   listing meta    -> the quiz count. Questions and plays are summed from the rows on
 *                      screen because the backend reports no library-wide totals for
 *                      them, which is what the note under the stats says.
 *
 * What the listing endpoint answers, and how this page reads it:
 *   data.quizzes             -> the rows, already mapped to cards by quizzes.api
 *   meta.pagination.limit    -> echo of the requested page size, not used here
 *   meta.pagination.nextCursor / hasMore -> "Load more"
 *   meta.pagination.total    -> ONLY present on the first page, and only because the
 *                               request asked with include_total=true. It counts the
 *                               current visibility filter, not the whole library.
 *   error.message            -> read through toErrorMessage, never error.message on
 *                               the axios error, which is just "Request failed...".
 *
 * Pagination is keyset based, so filtering and sorting happen on the server: a cursor
 * page only covers a slice of the library, and a cursor is bound to the filters it was
 * issued for.
 *
 * The page has no keyword field: search across quizzes lives on Discover, so the
 * `keyword` parameter of the endpoint is simply never sent from here.
 */
const auth = useAuthStore()
const ui = useUiStore()

const PAGE_SIZE = 24

// Values accepted by the `visibility` parameter of GET /quizzes/me.
const VISIBILITIES = [
  { value: 'all', label: 'All' },
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
]

// "Member since August 2026": a join date needs no day to be useful.
const MONTH_YEAR = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })

const pageEl = ref(null)
const gridEl = ref(null)

// One kill handle per revealed page, released together when the page unmounts.
const gridReveals = []

const visibility = ref('all')
const sort = ref('recently_updated')

// The quiz waiting for a delete confirmation, and whether the request is in flight.
const pendingDelete = ref(null)
const deleting = ref(false)

// Every quiz in this library belongs to the signed-in user, so one author request
// covers the header and all the cards.
const ownerId = computed(() => auth.user?.id ?? null)

/**
 * Author request. It is created here, next to the list, and vue-query fires it while
 * the first listing page is still in flight - the two never queue behind each other.
 *
 * A failure is not fatal: the session already carries the same name, avatar, email and
 * intro, so the card falls back to it instead of leaving a hole at the top of the page.
 */
const profile = useQuery({
  queryKey: ['users', 'public', ownerId],
  queryFn: () => getPublicUser(ownerId.value),
  enabled: computed(() => Boolean(ownerId.value)),
  retry: false,
  staleTime: 5 * 60 * 1000,
})

const list = useCursorList(
  (params) => getMyQuizzes(params),
  () => ({
    visibility: visibility.value,
    sort: sort.value,
    limit: PAGE_SIZE,
  }),
  {
    // The session probe resolves before this route is entered, but a direct store
    // reset would leave the list without an owner, so the guard stays.
    enabled: () => auth.ready && Boolean(auth.user?.id),
    includeTotal: true,
    errorFallback: 'Could not load your quizzes.',
  },
)

const quizzes = list.items

/**
 * The full author row behind the header card. The fetched public row wins field by
 * field, the session row is what keeps the card filled while that request is still
 * running and what covers it entirely if the request fails.
 */
const author = computed(() => {
  const fetched = profile.data.value
  const session = auth.user
  const row = fetched ?? session
  if (!row?.id) return null

  return {
    id: row.id,
    fullname: row.fullname ?? session?.fullname ?? '',
    avatar: row.avatar ?? session?.avatar ?? null,
    email: row.email ?? session?.email ?? '',
    description: row.description ?? session?.description ?? '',
  }
})

const authorName = computed(() => author.value?.fullname || 'You')

const authorAvatar = computed(() => author.value?.avatar || '')

const authorBio = computed(() => author.value?.description?.trim() || '')

const authorRoute = computed(() =>
  author.value ? { name: 'user-profile', params: { id: author.value.id } } : null,
)

/**
 * Account facts the public row does not carry. They come from the session, so they are
 * only ever shown for the person actually signed in - which on this page is always the
 * owner of the library.
 */
const memberSince = computed(() => {
  const raw = auth.user?.created_at ?? auth.user?.createdAt
  if (!raw) return ''

  const joined = new Date(raw)
  if (Number.isNaN(joined.getTime())) return ''

  return `Member since ${MONTH_YEAR.format(joined)}`
})

// Only worth a chip when it says something: a plain local account gets none.
const accountBadges = computed(() => {
  const badges = []
  const role = auth.user?.role

  if (role && role !== 'user') badges.push(role.charAt(0).toUpperCase() + role.slice(1))
  if (auth.user?.auth_provider === 'google') badges.push('Google account')

  return badges
})

/**
 * The card contract is `{ id, fullname, avatar }` and nothing else, so the extra header
 * fields never leak into a quiz row.
 */
const cardAuthor = computed(() => {
  const row = author.value
  if (!row) return null

  return { id: row.id, fullname: row.fullname, avatar: row.avatar }
})

/**
 * The listing rows carry whatever author block the backend joined in. Where it is
 * missing, the author fetched above is filled in: on this page the owner is known for
 * certain, which is what turns the face on every card into a working profile link.
 */
const cards = computed(() => {
  const owner = cardAuthor.value
  if (!owner) return quizzes.value

  return quizzes.value.map((quiz) =>
    quiz.owner ? quiz : { ...quiz, owner, ownerId: quiz.ownerId ?? owner.id },
  )
})

/*
 * While the session is still being resolved the list is not allowed to load, so its
 * `loading` flag is false and the rows are empty. Rendering that as "Nothing here yet"
 * flashed an empty library on every hard refresh, so the unresolved session counts as
 * loading instead.
 */
const isLoading = computed(() => !auth.ready || list.loading.value)

const total = computed(() => list.total.value)

const loadedCount = computed(() => quizzes.value.length)

const hasFilters = computed(() => visibility.value !== 'all')

// The backend only sends a total on the first page, so the loaded row count stands in
// for it until it does.
const quizCount = computed(() => total.value ?? loadedCount.value)

const countLabel = computed(() => {
  if (isLoading.value) return ''
  return `${quizCount.value} ${quizCount.value === 1 ? 'quiz' : 'quizzes'}`
})

const questionTotal = computed(() =>
  quizzes.value.reduce((sum, quiz) => sum + (quiz.questionCount ?? 0), 0),
)

const playTotal = computed(() =>
  quizzes.value.reduce((sum, quiz) => sum + (quiz.playCount ?? 0), 0),
)

const stats = computed(() => [
  { key: 'quizzes', label: quizCount.value === 1 ? 'Quiz' : 'Quizzes', value: quizCount.value },
  { key: 'questions', label: 'Questions', value: questionTotal.value },
  { key: 'plays', label: 'Plays', value: playTotal.value },
])

// Questions and plays are summed from the rows on screen. While a cursor page is still
// unloaded they are a partial figure, and saying so is cheaper than hiding them.
const statsNote = computed(() => {
  if (!list.hasMore.value || !loadedCount.value) return ''
  return `Questions and plays cover the ${loadedCount.value} quizzes loaded so far.`
})

// Only shown while part of the library is still unloaded, and only when the backend
// actually sent a total: the row count alone never stands in for it.
const rangeLabel = computed(() => {
  if (total.value === null || total.value <= loadedCount.value) return ''
  return `Showing ${loadedCount.value} of ${total.value}`
})

const activeSortLabel = computed(
  () => LIBRARY_SORTS.find((item) => item.value === sort.value)?.label ?? '',
)

function clearFilters() {
  visibility.value = 'all'
}

/**
 * Deleting is irreversible on the backend, so it goes through an in-page dialog rather
 * than window.confirm, which cannot be styled and blocks the whole tab.
 */
function askDelete(quiz) {
  pendingDelete.value = quiz
}

function cancelDelete() {
  if (deleting.value) return
  pendingDelete.value = null
}

/**
 * After a successful delete the list reloads from the first page instead of splicing
 * the row out locally: the following cursor pages shift by one, so a local removal
 * would make "Load more" skip a quiz.
 */
async function confirmDelete() {
  const quiz = pendingDelete.value
  if (!quiz || deleting.value) return

  deleting.value = true
  try {
    await deleteQuiz(quiz.id)
    ui.toast('Quiz deleted.', 'success')
    pendingDelete.value = null
    await list.loadFirst()
  } catch (error) {
    // The envelope carries the reason under error.message (404 gone, 403 not yours),
    // which only toErrorMessage reads; error.message alone is the axios status text.
    ui.toast(toErrorMessage(error, 'Could not delete this quiz.'), 'error')
  } finally {
    deleting.value = false
  }
}

function onKeydown(event) {
  if (event.key === 'Escape') cancelDelete()
}

/**
 * The dialog covers the page, so the page behind it must not scroll. Lenis drives the
 * scroll itself, so pausing it is what actually freezes the page; the inline overflow
 * lock is the fallback for the reduced-motion path where Lenis is off.
 */
watch(pendingDelete, (quiz) => {
  const lenis = window.__lenis

  if (quiz) {
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
 * be touched. Re-running the reveal across the whole grid would hide the cards the
 * reader already scrolled past, and they would never come back.
 *
 * This watches the raw rows, not `cards`: the author landing later only patches the
 * existing nodes in place, which must not start an animation.
 */
watch(
  quizzes,
  async (rows) => {
    if (!rows.length) return

    await nextTick()
    gridReveals.push(revealAppended(gridEl.value, '[data-reveal-card]', { y: 16, stagger: 0.04 }))
    // Layout height changed with the new row count.
    ScrollTrigger.refresh()
  },
  { immediate: true },
)
</script>

<template>
  <div ref="pageEl" class="container-page pb-xxl pt-lg">
    <!-- Author card. Everything a visitor sees on the public profile, plus the account
         facts only the owner is allowed to read. -->
    <section v-if="!author" class="profile-card" data-enter>
      <span class="skeleton-avatar" />
      <div class="profile-main">
        <span class="skeleton-line" style="width: 30%" />
        <span class="skeleton-line skeleton-line-tall" style="width: 46%" />
        <span class="skeleton-line" style="width: 62%" />
      </div>
    </section>

    <section v-else class="profile-card" data-enter>
      <RouterLink
        :to="authorRoute"
        class="profile-avatar"
        :title="`View ${authorName}`"
      >
        <UserAvatar :name="authorName" :src="authorAvatar" :size="84" />
        <span class="sr-only">View the public profile of {{ authorName }}</span>
      </RouterLink>

      <div class="profile-main">
        <p class="eyebrow-label">
          Your work
        </p>
        <h1 class="profile-name">
          {{ authorName }}
        </h1>

        <p class="profile-meta">
          <span v-if="author.email" class="profile-email">{{ author.email }}</span>
          <template v-if="author.email && memberSince">
            <span class="profile-dot" />
          </template>
          <span v-if="memberSince">{{ memberSince }}</span>
        </p>

        <p v-if="accountBadges.length" class="profile-badges">
          <span v-for="badge in accountBadges" :key="badge" class="chip">{{ badge }}</span>
        </p>

        <p class="profile-bio" :class="authorBio ? '' : 'is-empty'">
          {{ authorBio || 'No intro yet. Add one so players know who is behind your quizzes.' }}
        </p>
      </div>

      <div class="profile-actions">
        <RouterLink :to="{ name: 'profile' }" class="btn-utility">
          Edit profile
        </RouterLink>
        <RouterLink :to="authorRoute" class="btn-ghost">
          View public profile
        </RouterLink>
      </div>

      <dl class="profile-stats">
        <div v-for="stat in stats" :key="stat.key" class="stat">
          <dt class="stat-label">
            {{ stat.label }}
          </dt>
          <dd class="stat-value num" :title="formatCount(stat.value)">
            <template v-for="(group, index) in groupDigits(stat.value)" :key="index">
              <i v-if="index" class="ts" />{{ group }}
            </template>
          </dd>
        </div>
      </dl>

      <p v-if="statsNote" class="profile-note">
        {{ statsNote }}
      </p>
    </section>

    <!-- One bar for the listing itself: what is being shown, and how. -->
    <div class="toolbar" data-enter>
      <div class="toolbar-heading">
        <h2 class="toolbar-title">
          My Library
        </h2>
        <span v-if="countLabel" class="toolbar-count">{{ countLabel }}</span>
      </div>

      <!-- Visibility is one choice out of three, so it reads as a segmented control. -->
      <div class="segmented" role="group" aria-label="Visibility">
        <button
          v-for="item in VISIBILITIES"
          :key="item.value"
          type="button"
          class="segment"
          :class="visibility === item.value ? 'is-active' : ''"
          :aria-pressed="visibility === item.value"
          @click="visibility = item.value"
        >
          {{ item.label }}
        </button>
      </div>

      <div class="select-wrap">
        <select v-model="sort" class="select-field" :aria-label="`Sort: ${activeSortLabel}`">
          <option v-for="item in LIBRARY_SORTS" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
        </select>
        <svg
          class="select-chevron"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>

    <!-- Skeletons carry the shape of a card, so the grid does not jump when rows land. -->
    <div
      v-if="isLoading"
      class="mt-lg grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4"
      data-enter
    >
      <div v-for="n in 8" :key="`skeleton-${n}`" class="skeleton-card">
        <span class="skeleton-cover" />
        <span class="skeleton-body">
          <span class="skeleton-line" style="width: 78%" />
          <span class="skeleton-line" style="width: 52%" />
          <span class="skeleton-line skeleton-line-last" style="width: 38%" />
        </span>
      </div>
    </div>

    <div v-else-if="list.errorMessage.value" class="state-card is-error mt-lg" data-enter>
      <p class="text-title text-ink">
        This did not load
      </p>
      <p class="state-text">
        {{ list.errorMessage.value }}
      </p>
      <button class="btn-utility mt-md" type="button" @click="list.loadFirst()">
        Try again
      </button>
    </div>

    <!-- An empty library and an empty filter result need different exits. -->
    <div v-else-if="!quizzes.length && hasFilters" class="state-card mt-lg" data-enter>
      <span class="state-icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
        </svg>
      </span>
      <p class="text-title text-ink">
        No matches
      </p>
      <p class="state-text">
        No quiz in your library is set to this visibility.
      </p>
      <button class="btn-utility mt-md" type="button" @click="clearFilters">
        Show all
      </button>
    </div>

    <div v-else-if="!quizzes.length" class="state-card mt-lg" data-enter>
      <span class="state-icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h3l2 2.5h6A2.5 2.5 0 0 1 20 10v6.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5Z" />
          <path d="M12 11v5" />
          <path d="M9.5 13.5h5" />
        </svg>
      </span>
      <p class="text-title text-ink">
        Nothing here yet
      </p>
      <p class="state-text">
        Your library holds every quiz you build. Start with one question.
      </p>
      <RouterLink :to="{ name: 'create-start' }" class="btn-primary mt-md">
        Create a quiz
      </RouterLink>
    </div>

    <template v-else>
      <div v-if="rangeLabel" class="mt-lg flex items-center justify-between gap-sm">
        <p class="text-caption text-ink-3">
          {{ rangeLabel }}
        </p>
        <span v-if="list.loadingMore.value" class="text-caption text-ink-3">
          Loading more…
        </span>
      </div>

      <!-- Same grid as the home feed, so a card is the same size on both screens. -->
      <div
        ref="gridEl"
        class="mt-lg grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4"
      >
        <QuizCard
          v-for="quiz in cards"
          :key="quiz.id"
          :quiz="quiz"
          show-owner-badges
          data-reveal-card
        >
          <template #actions>
            <RouterLink
              :to="{ name: 'edit-quiz', params: { id: quiz.id } }"
              class="card-action"
              :title="`Edit ${quiz.title}`"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              <span class="sr-only">Edit {{ quiz.title }}</span>
            </RouterLink>
            <button
              type="button"
              class="card-action card-action-danger"
              :title="`Delete ${quiz.title}`"
              @click="askDelete(quiz)"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M4 7h16" />
                <path d="M9 7V5h6v2" />
                <path d="M6 7h12l-.9 12.1a1 1 0 0 1-1 .9H7.9a1 1 0 0 1-1-.9Z" />
              </svg>
              <span class="sr-only">Delete {{ quiz.title }}</span>
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

    <!--
      Teleported: the page root carries a transform while the entrance animation runs,
      and a fixed element inside a transformed ancestor is positioned against that
      ancestor instead of the viewport.
    -->
    <Teleport to="body">
      <div v-if="pendingDelete" class="dialog-backdrop" @click.self="cancelDelete">
        <div
          class="dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-quiz-title"
        >
          <p id="delete-quiz-title" class="text-heading-3 text-ink">
            Delete this quiz?
          </p>
          <p class="mt-xs text-body-sm text-ink-2">
            “{{ pendingDelete.title }}” and its questions go away for everyone. This cannot be undone.
          </p>
          <div class="mt-lg flex justify-end gap-xs">
            <button class="btn-utility" type="button" :disabled="deleting" @click="cancelDelete">
              Keep it
            </button>
            <button class="btn-danger" type="button" :disabled="deleting" @click="confirmDelete">
              {{ deleting ? 'Deleting…' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/*
  Author card: avatar, identity and actions on one row, the stats strip underneath on
  its own line so the three tiles keep their width whatever the name is.
*/
.profile-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 20px;
  padding: 24px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-xl);
  background-color: var(--paper);
}

.profile-avatar {
  display: block;
  border-radius: var(--r-full);
  transition:
    transform var(--t-ui) var(--ease),
    box-shadow var(--t-ui) var(--ease);
}

.profile-avatar:hover {
  transform: scale(1.04);
  box-shadow: 0 0 0 4px var(--spotlight-soft);
}

.profile-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.profile-name {
  margin-top: 4px;
  overflow: hidden;
  color: var(--ink);
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.024em;
  line-height: 1.15;
  text-overflow: ellipsis;
}

.profile-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  color: var(--ink-3);
  font-size: 13.5px;
  line-height: 1.3;
}

.profile-email {
  max-width: 100%;
  overflow: hidden;
  color: var(--ink-2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-dot {
  width: 3px;
  height: 3px;
  border-radius: var(--r-full);
  background-color: var(--hairline);
}

.profile-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.profile-bio {
  max-width: 58ch;
  margin-top: 10px;
  color: var(--ink-2);
  font-size: 15px;
  line-height: 1.55;
}

/* The placeholder is a prompt, not content, so it never reads as an intro. */
.profile-bio.is-empty {
  color: var(--ink-3);
}

.profile-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.profile-stats {
  display: flex;
  flex-wrap: wrap;
  grid-column: 1 / -1;
  gap: 8px;
}

.stat {
  flex: 1 1 140px;
  padding: 12px 16px;
  border-radius: var(--r-md);
  background-color: var(--canvas);
}

.stat-label {
  color: var(--ink-3);
  font-size: 12.5px;
  letter-spacing: 0.01em;
}

.stat-value {
  margin-top: 4px;
  color: var(--ink);
  font-size: 21px;
  font-weight: 700;
  line-height: 1.1;
}

.profile-note {
  grid-column: 1 / -1;
  margin-top: -8px;
  color: var(--ink-3);
  font-size: 12.5px;
}

/* Below this width the actions cannot share the row without squeezing the name. */
@media (max-width: 760px) {
  .profile-card {
    grid-template-columns: auto minmax(0, 1fr);
    padding: 20px;
  }

  .profile-actions {
    grid-column: 1 / -1;
  }

  .profile-name {
    font-size: 26px;
  }
}

/* Every listing control sits on one paper bar, aligned on a single 40px baseline. */
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding: 12px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  background-color: var(--paper);
}

/* The auto margin is what pushes the filters to the right of the bar. */
.toolbar-heading {
  display: flex;
  align-items: baseline;
  min-width: 0;
  margin-right: auto;
  gap: 10px;
  padding-left: 4px;
}

.toolbar-title {
  color: var(--ink);
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.018em;
}

.toolbar-count {
  color: var(--ink-3);
  font-size: 13px;
}

/*
  Segmented control on a canvas track: the choice reads as one control with three
  states instead of three separate buttons that happen to sit next to each other.
*/
.segmented {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-full);
  background-color: var(--canvas);
}

.segment {
  height: 32px;
  padding: 0 16px;
  border-radius: var(--r-full);
  color: var(--ink-2);
  font-size: 14px;
  transition:
    background-color var(--t-ui) var(--ease),
    color var(--t-ui) var(--ease),
    box-shadow var(--t-ui) var(--ease);
}

.segment:hover {
  color: var(--ink);
}

.segment.is-active {
  background-color: var(--paper);
  color: var(--spotlight);
  font-weight: 600;
  box-shadow: var(--sh-1);
}

.select-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.select-field {
  height: 40px;
  padding: 0 34px 0 14px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-md);
  background-color: var(--paper);
  color: var(--ink);
  font-size: 14.5px;
  cursor: pointer;
  appearance: none;
  transition:
    border-color var(--t-ui) var(--ease),
    box-shadow var(--t-ui) var(--ease);
}

.select-field:hover {
  border-color: var(--spotlight-line);
}

.select-field:focus {
  outline: none;
  border-color: var(--spotlight);
  box-shadow: 0 0 0 4px var(--spotlight-soft);
}

.select-chevron {
  position: absolute;
  right: 12px;
  width: 15px;
  height: 15px;
  color: var(--ink-3);
  pointer-events: none;
}

/*
  Owner actions float over the cover, so they are round paper chips rather than the
  text pills the cover used to carry: two words each stacked into a grey brick.
*/
.card-action {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-full);
  background-color: rgba(255, 255, 255, 0.94);
  color: var(--ink-2);
  box-shadow: var(--sh-1);
  backdrop-filter: blur(6px);
  transition:
    color var(--t-ui) var(--ease),
    border-color var(--t-ui) var(--ease),
    background-color var(--t-ui) var(--ease),
    transform var(--t-fast) var(--ease);
}

.card-action svg {
  width: 15px;
  height: 15px;
}

.card-action:hover {
  border-color: var(--spotlight-line);
  background-color: #ffffff;
  color: var(--spotlight);
}

.card-action:active {
  transform: scale(0.94);
}

/* Answer A is the only answer colour a control may wear, and only to destroy. */
.card-action-danger:hover {
  border-color: var(--ans-a);
  color: var(--ans-a);
}

.state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  background-color: var(--paper);
  text-align: center;
}

.state-card.is-error {
  border-color: var(--ans-a);
  background-color: var(--ans-a-soft);
}

.state-icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  margin-bottom: 16px;
  border-radius: var(--r-full);
  background-color: var(--wash);
  color: var(--spotlight);
}

.state-icon svg {
  width: 24px;
  height: 24px;
}

.state-text {
  max-width: 420px;
  margin-top: 8px;
  color: var(--ink-2);
  font-size: 15px;
  line-height: 1.5;
}

/* Card-shaped placeholder: cover block, two text lines, one meta line. */
.skeleton-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  background-color: var(--paper);
}

.skeleton-cover {
  display: block;
  aspect-ratio: 16 / 10;
  background-color: var(--canvas);
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

.skeleton-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
}

.skeleton-avatar {
  display: block;
  width: 84px;
  height: 84px;
  border-radius: var(--r-full);
  background-color: var(--canvas);
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

.skeleton-line {
  display: block;
  height: 12px;
  border-radius: var(--r-sm);
  background-color: var(--canvas);
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

.skeleton-line + .skeleton-line {
  margin-top: 10px;
}

.skeleton-line-tall {
  height: 22px;
}

.skeleton-line-last {
  margin-top: 10px;
  height: 10px;
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.55;
  }
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  padding: 20px;
  background-color: rgba(35, 36, 43, 0.32);
}

.dialog {
  width: 100%;
  max-width: 420px;
  padding: 24px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-xl);
  background-color: var(--paper);
  box-shadow: var(--sh-2);
}

@media (prefers-reduced-motion: reduce) {
  .profile-avatar,
  .segment,
  .select-field,
  .card-action {
    transition: none;
  }

  .profile-avatar:hover {
    transform: none;
  }

  .skeleton-avatar,
  .skeleton-cover,
  .skeleton-line {
    animation: none;
  }
}
</style>
