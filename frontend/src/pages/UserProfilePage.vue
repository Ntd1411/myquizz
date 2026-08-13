<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import QuizCard from '@/components/quiz/QuizCard.vue'
import UserAvatar from '@/components/base/UserAvatar.vue'
import { getQuizzesByOwner } from '@/api/quizzes.api'
import { getPublicUser } from '@/api/users.api'
import { PROFILE_SORTS } from '@/constants/quizMeta'
import { groupDigits, formatCount } from '@/utils/formatNumber'
import { useCursorList } from '@/composables/useCursorList'
import { useAuthStore } from '@/stores/auth.store'
import { revealOnEnter, revealOnScroll, ScrollTrigger } from '@/composables/useMotion'

/**
 * Public profile of a creator.
 *
 * Two independent sources, both leaving in the same tick - vue-query fires the user
 * request while useCursorList is already asking for the first listing page, so the
 * screen costs one round trip rather than two:
 *
 *   GET /users/:id                 -> the whole public row: fullname, email, avatar,
 *                                     description, role and created_at. Everything the
 *                                     backend is willing to show about the account is
 *                                     rendered here.
 *   GET /quizzes/users/id/:ownerId -> the listing
 *
 * That listing only ever returns public quizzes with at least one question, so an
 * empty result does not mean the account is empty and must never be shown as "user not
 * found" - a missing account is only the header request failing.
 *
 * The header stats mix the two sources on purpose: the quiz count is the authoritative
 * meta.pagination.total from the listing, while questions and plays are summed from
 * the rows on screen because no endpoint reports them per creator. The note under the
 * stats says so whenever a cursor page is still unloaded.
 *
 * Fields the backend deliberately withholds from /users/:id - auth_provider and phone -
 * are not shown here, and no second request tries to reach them: how an account signs
 * in and how to phone it are nobody else's business.
 */
const props = defineProps({
  id: { type: String, required: true },
})

const auth = useAuthStore()

const PAGE_SIZE = 24

// "Member since August 2026": a join date needs no day to be useful.
const MONTH_YEAR = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })

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

const displayName = computed(() => user.value?.fullname?.trim() || 'Creator')

const avatarUrl = computed(() => user.value?.avatar || '')

const email = computed(() => user.value?.email || '')

const bio = computed(() => user.value?.description?.trim() || '')

// Join date, straight from the public row and rendered on its own line under the
// contact line: two separate facts, two lines.
const memberSince = computed(() => {
  const raw = user.value?.created_at
  if (!raw) return ''

  const joined = new Date(raw)
  if (Number.isNaN(joined.getTime())) return ''

  return `Member since ${MONTH_YEAR.format(joined)}`
})

// Staff roles only. Everyone is a plain 'user', so printing that says nothing.
const accountBadges = computed(() => {
  const role = user.value?.role
  if (!role || role === 'user') return []

  return [
    { key: 'role', label: role.charAt(0).toUpperCase() + role.slice(1), tone: 'brand' },
  ]
})

// Route params are strings, the session id is a number: comparing them raw always
// answered false and hid the "my library" shortcut from its owner.
const isSelf = computed(
  () => Boolean(auth.user?.id) && String(auth.user.id) === String(ownerId.value),
)

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

const loadedCount = computed(() => quizzes.value.length)

// The total only rides along on the first page, so the loaded row count stands in for
// it until the backend actually reports one.
const quizCount = computed(() => list.total.value ?? loadedCount.value)

const questionTotal = computed(() =>
  quizzes.value.reduce((sum, quiz) => sum + (quiz.questionCount ?? 0), 0),
)

const playTotal = computed(() =>
  quizzes.value.reduce((sum, quiz) => sum + (quiz.playCount ?? 0), 0),
)

const stats = computed(() => [
  {
    key: 'quizzes',
    label: quizCount.value === 1 ? 'Public quiz' : 'Public quizzes',
    value: quizCount.value,
  },
  { key: 'questions', label: 'Questions', value: questionTotal.value },
  { key: 'plays', label: 'Plays', value: playTotal.value },
])

const statsNote = computed(() => {
  if (!list.hasMore.value || !loadedCount.value) return ''
  return `Questions and plays cover the ${loadedCount.value} quizzes loaded so far.`
})

const activeSortLabel = computed(
  () => PROFILE_SORTS.find((item) => item.value === sort.value)?.label ?? '',
)

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
    <section v-if="profile.isLoading.value" class="profile-card">
      <span class="skeleton-avatar" />
      <div class="profile-main skeleton-main">
        <span class="skeleton-line" style="width: 26%" />
        <span class="skeleton-line skeleton-line-tall" style="width: 44%" />
        <span class="skeleton-line" style="width: 60%" />
      </div>
    </section>

    <div v-else-if="profile.isError.value" class="state-card" data-enter>
      <p class="text-title text-ink">
        Creator not found
      </p>
      <p class="state-text">
        This account does not exist or is no longer active.
      </p>
      <RouterLink :to="{ name: 'discover' }" class="btn-primary mt-md">
        Discover quizzes
      </RouterLink>
    </div>

    <template v-else>
      <!-- Everything /users/:id is willing to say about this account. -->
      <section class="profile-card" data-enter>
        <span class="profile-avatar">
          <UserAvatar :name="displayName" :src="avatarUrl" :size="84" />
        </span>

        <div class="profile-main">
          <p class="eyebrow-label">
            Creator
          </p>
          <!-- A badge qualifies the name, so it rides on the same line instead of
               claiming one of its own. -->
          <div class="profile-headline">
            <h1 class="profile-name">
              {{ displayName }}
            </h1>

            <p v-if="accountBadges.length" class="profile-badges">
              <span
                v-for="badge in accountBadges"
                :key="badge.key"
                class="badge"
                :class="`badge-${badge.tone}`"
              >
                {{ badge.label }}
              </span>
            </p>
          </div>

          <p v-if="email" class="profile-meta">
            <a class="profile-email" :href="`mailto:${email}`">{{ email }}</a>
          </p>

          <p v-if="memberSince" class="profile-since">
            {{ memberSince }}
          </p>

          <p class="profile-bio" :class="bio ? '' : 'is-empty'">
            {{ bio || 'This creator has not written an intro yet.' }}
          </p>
        </div>

        <div v-if="isSelf" class="profile-actions">
          <RouterLink :to="{ name: 'library' }" class="btn-utility">
            Manage my library
          </RouterLink>
          <RouterLink :to="{ name: 'profile' }" class="btn-ghost">
            Edit profile
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

      <div class="toolbar" data-enter>
        <h2 class="toolbar-title">
          Quizzes
        </h2>

        <div class="select-wrap">
          <select v-model="sort" class="select-field" :aria-label="`Sort: ${activeSortLabel}`">
            <option v-for="item in PROFILE_SORTS" :key="item.value" :value="item.value">
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
      <div v-if="list.loading.value" class="mt-lg grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="n in 8" :key="`skeleton-${n}`" class="skeleton-card">
          <span class="skeleton-cover" />
          <span class="skeleton-body">
            <span class="skeleton-line" style="width: 78%" />
            <span class="skeleton-line" style="width: 52%" />
            <span class="skeleton-line skeleton-line-last" style="width: 38%" />
          </span>
        </div>
      </div>

      <div v-else-if="list.errorMessage.value" class="state-card is-error mt-lg">
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

      <!-- Empty listing, not a missing account: the endpoint hides drafts and private quizzes. -->
      <div v-else-if="!quizzes.length" class="state-card mt-lg">
        <p class="text-title text-ink">
          No public quizzes yet
        </p>
        <p class="state-text">
          {{
            isSelf
              ? 'Your private quizzes and quizzes without questions are only visible in your library.'
              : 'This creator has not published anything yet.'
          }}
        </p>
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
    </template>
  </div>
</template>

<style scoped>
/*
  Same author card as the library, so a creator looks identical whether the visitor is
  the owner or a stranger: avatar, identity and actions on one row, stats underneath.
*/
.profile-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  /*
    Only the columns are spaced by the grid. The rows below the identity carry their
    own margins instead, because a single row gap cannot separate the stats strip from
    the identity and the note from the stats by different amounts - the note used to
    claw a gap back with a negative margin.
  */
  column-gap: 22px;
  row-gap: 0;
  padding: 26px 28px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-xl);
  background-color: var(--paper);
}

/* Nothing to link to here: this page already is the profile. */
.profile-avatar {
  display: block;
}

.profile-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/*
  Name and badges on one line. The row wraps, so a long name pushes the badges onto a
  second line rather than squeezing them, and the row gap is what spaces them then.
*/
.profile-headline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  margin-top: 6px;
}

.profile-name {
  min-width: 0;
  overflow: hidden;
  color: var(--ink);
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.024em;
  line-height: 1.15;
  text-overflow: ellipsis;
}

/*
  Contact line, then the join date underneath. They are one block of small print, so
  they sit tight against each other and keep their distance from the name above and
  the badges below.
*/
.profile-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 13.5px;
  line-height: 1.45;
}

.profile-email {
  max-width: 100%;
  overflow: hidden;
  color: var(--ink-2);
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--t-ui) var(--ease);
}

.profile-email:hover {
  color: var(--spotlight);
}

.profile-since {
  color: var(--ink-3);
  font-size: 13px;
  line-height: 1.45;
}

/* Never shrinks: the name gives up its width first, a badge is unreadable clipped. */
.profile-badges {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 6px;
}

/*
  A badge states a fact about the account and nothing more, so it is smaller and
  flatter than .chip, which is a control the reader can press elsewhere in the app.
*/
.badge {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: var(--r-full);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1;
  white-space: nowrap;
}

/* Standing in the product: worth the brand colour. */
.badge-brand {
  border-color: var(--spotlight-line);
  background-color: var(--spotlight-soft);
  color: var(--spotlight);
}

.profile-bio {
  max-width: 58ch;
  margin-top: 16px;
  color: var(--ink-2);
  font-size: 15px;
  line-height: 1.55;
}

/* The placeholder is a statement about the account, not content it wrote. */
.profile-bio.is-empty {
  color: var(--ink-3);
}

.profile-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Its own band under the identity, far enough down to read as a separate statement. */
.profile-stats {
  display: flex;
  flex-wrap: wrap;
  grid-column: 1 / -1;
  gap: 12px;
  margin-top: 26px;
}

.stat {
  flex: 1 1 140px;
  padding: 14px 18px;
  border-radius: var(--r-md);
  background-color: var(--canvas);
}

.stat-label {
  color: var(--ink-3);
  font-size: 12px;
  letter-spacing: 0.01em;
  line-height: 1.3;
}

.stat-value {
  margin-top: 6px;
  color: var(--ink);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.1;
}

/* A footnote to the strip above, so it stays closer to it than the strip is to the
   identity. */
.profile-note {
  grid-column: 1 / -1;
  margin-top: 10px;
  color: var(--ink-3);
  font-size: 12.5px;
  line-height: 1.4;
}

/* Below this width the actions cannot share the row without squeezing the name. */
@media (max-width: 760px) {
  .profile-card {
    grid-template-columns: auto minmax(0, 1fr);
    padding: 22px 20px;
  }

  /* Off the identity row and onto their own, so they need the gap the grid no longer
     provides. */
  .profile-actions {
    grid-column: 1 / -1;
    margin-top: 18px;
  }

  .profile-stats {
    margin-top: 22px;
  }

  .profile-name {
    font-size: 26px;
  }
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
  padding: 12px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  background-color: var(--paper);
}

.toolbar-title {
  padding-left: 4px;
  color: var(--ink);
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.018em;
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

.state-text {
  max-width: 440px;
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

/* The placeholder stands in for the identity block, so it starts on the same line as
   the eyebrow it replaces. */
.skeleton-main {
  padding-top: 6px;
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

@media (prefers-reduced-motion: reduce) {
  .profile-email,
  .select-field {
    transition: none;
  }

  .skeleton-avatar,
  .skeleton-cover,
  .skeleton-line {
    animation: none;
  }
}
</style>
