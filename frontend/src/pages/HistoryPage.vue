<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getGameHistory } from '@/api/games.api'
import { modeLabel } from '@/constants/gameConfig'
import { useCursorList } from '@/composables/useCursorList'
import { useInfiniteScroll } from '@/composables/useInfiniteScroll'
import { revealOnEnter } from '@/composables/useMotion'
import { useAuthStore } from '@/stores/auth.store'

/**
 * Play history.
 *
 * Public route: a guest's matches are real rows in player_sessions, keyed by the UUID
 * their browser already carries, so this screen works without an account and says so
 * plainly instead of pretending the history is safe. Rows are keyed on the session id,
 * never on the room code, because codes are only unique among open rooms and get
 * handed out again once a room closes.
 *
 * The page borrows the listing furniture of My library on purpose - one paper bar for
 * what is being shown, one row per match, the same state cards - so a reader who knows
 * that screen already knows this one.
 */

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const TABS = [
  { key: 'played', label: 'Played' },
  { key: 'hosted', label: 'Hosted' },
]

const pageEl = ref(null)

// Hosting needs an account, so the second tab does not exist for a guest; the endpoint
// answers 401 for that pair rather than an empty list.
const tabs = computed(() => (auth.isLoggedIn ? TABS : TABS.slice(0, 1)))

const role = computed(() =>
  route.query.role === 'hosted' && auth.isLoggedIn ? 'hosted' : 'played',
)

/**
 * useCursorList speaks the listing vocabulary (`quizzes`), so the history page is
 * adapted here rather than forking the composable: the shape is identical, only the
 * rows are matches instead of quizzes.
 */
async function fetchPage(params) {
  const page = await getGameHistory({
    role: params.role,
    cursor: params.cursor,
    includeTotal: params.includeTotal,
    asGuest: !auth.isLoggedIn,
  })
  return { quizzes: page.sessions, pagination: page.pagination }
}

const { items, total, hasMore, loading, loadingMore, errorMessage, isEmpty, loadFirst, loadMore } =
  useCursorList(fetchPage, () => ({ role: role.value }), {
    // The session is resolved once before the first navigation; asking earlier would
    // send a guest header for a reader who turns out to be signed in.
    enabled: () => auth.ready,
    includeTotal: true,
    errorFallback: 'Could not load your play history.',
  })

const sentinel = ref(null)
useInfiniteScroll(sentinel, () => loadMore())

/*
 * While the session is still being resolved the list is not allowed to load, so its
 * `loading` flag is false and the rows are empty. Rendering that as "nothing here yet"
 * would flash an empty history on every hard refresh, so the unresolved session counts
 * as loading instead.
 */
const isLoading = computed(() => !auth.ready || loading.value)

// The backend only sends a total on the first page, so the loaded row count stands in
// for it until it does.
const matchCount = computed(() => total.value ?? items.value.length)

const countLabel = computed(() => {
  if (isLoading.value || errorMessage.value) return ''
  return `${matchCount.value} ${matchCount.value === 1 ? 'match' : 'matches'}`
})

const listTitle = computed(() =>
  role.value === 'hosted' ? 'Rooms you hosted' : 'Matches you played',
)

// Only stated once the session is resolved: a signed-in reader must never read it.
const showGuestNote = computed(() => auth.ready && !auth.isLoggedIn)

/**
 * Switching tabs restarts from the first page. A cursor is bound to the list it was
 * issued for, so replaying one across tabs is a 400; the watcher inside useCursorList
 * reloads as soon as the role changes, which drops the old cursor.
 */
function selectTab(key) {
  if (key === role.value) return
  router.replace({ query: key === 'played' ? {} : { role: key } })
}

const DAY = 86400000

/** Relative wording for a closing time, absolute once it is older than a week. */
function whenLabel(value) {
  if (!value) return ''
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return ''

  const diff = Date.now() - then
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`
  if (diff < DAY) return `${Math.floor(diff / 3600000)} h ago`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} d ago`

  return new Date(then).toLocaleDateString()
}

/** The exact stamp, kept on the title attribute so the relative wording stays short. */
function whenTitle(value) {
  if (!value) return ''
  const stamp = new Date(value)
  return Number.isNaN(stamp.getTime()) ? '' : stamp.toLocaleString()
}

// A cancelled room ended without a final scoreboard, which is worth saying once per row.
function isCancelled(entry) {
  return entry.session_status === 'cancelled'
}

// The cover falls back to the first letter of the quiz, so a row without an image is
// still a distinct shape rather than an empty grey box.
function coverInitial(entry) {
  const name = entry.quiz_name || entry.session_name || '?'
  return name.trim().charAt(0).toUpperCase() || '?'
}

onMounted(() => {
  revealOnEnter(pageEl.value)
})
</script>

<template>
  <div ref="pageEl" class="container-page pb-xxl pt-lg">
    <!--
      Said before the list, not after it: a guest who reads this later has already lost
      the history it warns about.
    -->
    <p v-if="showGuestNote" class="guest-note" data-enter>
      <span class="guest-note-icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        >
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 8v.5" />
          <path d="M12 11.5v4.5" />
        </svg>
      </span>
      <span>
        This history lives in this browser only. Clearing site data or switching browser
        loses it.
        <RouterLink
          class="guest-note-link"
          :to="{ name: 'login', query: { redirect: '/history' } }"
        >
          Sign in
        </RouterLink>
        to keep it for good.
      </span>
    </p>

    <!-- One bar for the listing itself: what is being shown, and which side of it. -->
    <div class="toolbar" data-enter>
      <div class="toolbar-heading">
        <h2 class="toolbar-title">
          {{ listTitle }}
        </h2>
        <span v-if="countLabel" class="toolbar-count">{{ countLabel }}</span>
      </div>

      <!-- Played and hosted are two views of one history, so they read as one control. -->
      <div v-if="tabs.length > 1" class="segmented" role="group" aria-label="History role">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="segment"
          :class="tab.key === role ? 'is-active' : ''"
          :aria-pressed="tab.key === role"
          @click="selectTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Skeletons carry the shape of a row, so the list does not jump when it lands. -->
    <div v-if="isLoading" class="history-list">
      <div v-for="n in 5" :key="`skeleton-${n}`" class="skeleton-row">
        <span class="skeleton-cover" />
        <span class="skeleton-body">
          <span class="skeleton-line" style="width: 46%" />
          <span class="skeleton-line skeleton-line-thin" style="width: 28%" />
        </span>
        <span class="skeleton-line skeleton-line-score" />
      </div>
    </div>

    <div v-else-if="errorMessage" class="state-card is-error">
      <p class="state-title">
        This did not load
      </p>
      <p class="state-text">
        {{ errorMessage }}
      </p>
      <button class="btn-utility mt-md" type="button" @click="loadFirst">
        Try again
      </button>
    </div>

    <!-- An empty history is a prompt, so it carries the way out of it. -->
    <div v-else-if="isEmpty" class="state-card">
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
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      </span>
      <p class="state-title">
        {{ role === 'hosted' ? 'No rooms yet' : 'No finished matches yet' }}
      </p>
      <p class="state-text">
        {{
          role === 'hosted'
            ? 'Rooms you open show up here once they end.'
            : 'Join a game with a room code and it will be waiting here afterwards.'
        }}
      </p>
      <RouterLink
        v-if="role === 'hosted'"
        :to="{ name: 'library' }"
        class="btn-primary mt-md"
      >
        Host a quiz
      </RouterLink>
      <RouterLink v-else :to="{ name: 'join-game' }" class="btn-primary mt-md">
        Join a game
      </RouterLink>
    </div>

    <template v-else>
      <ol class="history-list">
        <li v-for="entry in items" :key="entry.id">
          <RouterLink
            class="history-row"
            :to="{ name: 'history-detail', params: { sessionId: entry.id } }"
          >
            <span class="row-cover">
              <img
                v-if="entry.quiz_image"
                :src="entry.quiz_image"
                alt=""
                loading="lazy"
              >
              <span v-else class="row-cover-letter" aria-hidden="true">
                {{ coverInitial(entry) }}
              </span>
            </span>

            <span class="row-main">
              <span class="row-headline">
                <span class="row-title">
                  {{ entry.quiz_name || 'Deleted quiz' }}
                </span>
                <span class="chip">{{ modeLabel(entry.game_mode) }}</span>
                <span v-if="isCancelled(entry)" class="chip chip-warn">Cancelled</span>
              </span>
              <span class="row-meta">
                <span class="row-session">{{ entry.session_name }}</span>
                <span class="row-dot" aria-hidden="true" />
                <span class="row-when" :title="whenTitle(entry.ended_at)">
                  {{ whenLabel(entry.ended_at) }}
                </span>
              </span>
            </span>

            <!-- Played: the reader's own result. Hosted: the turnout of the room. -->
            <span v-if="role === 'played'" class="row-score">
              <span class="score-value num">{{ entry.player_score ?? 0 }}</span>
              <span v-if="entry.rank" class="score-rank num">
                #{{ entry.rank }} of {{ entry.total_players }}
              </span>
              <span v-else class="score-label">points</span>
            </span>
            <span v-else class="row-score">
              <span class="score-value num">{{ entry.total_players }}</span>
              <span class="score-label">
                {{ entry.total_players === 1 ? 'player' : 'players' }}
              </span>
            </span>

            <svg
              class="row-go"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </RouterLink>
        </li>
      </ol>

      <!-- Sentinel: reaching the end of the list asks for the next cursor page. -->
      <div v-if="hasMore" ref="sentinel" class="sentinel" aria-hidden="true" />

      <div v-if="hasMore" class="mt-lg flex justify-center">
        <button
          class="btn-utility"
          type="button"
          :disabled="loadingMore"
          @click="loadMore()"
        >
          {{ loadingMore ? 'Loading…' : 'Load more' }}
        </button>
      </div>

      <p v-else class="list-end">
        That is the whole history.
      </p>
    </template>
  </div>
</template>

<style scoped>
/* A standing condition of the page, so it is a quiet note rather than an alert. */
.guest-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 68ch;
  padding: 12px 16px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  background-color: var(--canvas);
  color: var(--ink-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.guest-note-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 20px;
  height: 20px;
  margin-top: 1px;
  color: var(--spotlight);
}

.guest-note-icon svg {
  width: 18px;
  height: 18px;
}

.guest-note-link {
  color: var(--spotlight);
  text-decoration: underline;
  text-decoration-color: var(--spotlight-line);
  text-underline-offset: 2px;
  transition: text-decoration-color var(--t-ui) var(--ease);
}

.guest-note-link:hover {
  text-decoration-color: var(--spotlight);
}

/* Same listing bar as My library, so the two screens read as one family. */
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
  padding: 12px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  background-color: var(--paper);
}

/* The auto margin is what pushes the control to the right of the bar. */
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

.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
  list-style: none;
}

/*
  One match per row: cover, what it was, what came of it. Three columns rather than a
  card grid, because the reader scans these by date and by result, not by picture.
*/
.history-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  background-color: var(--paper);
  text-decoration: none;
  transition:
    border-color var(--t-ui) var(--ease),
    box-shadow var(--t-ui) var(--ease),
    transform var(--t-fast) var(--ease);
}

.history-row:hover {
  border-color: var(--spotlight-line);
  box-shadow: var(--sh-1);
}

.history-row:active {
  transform: scale(0.995);
}

.row-cover {
  display: grid;
  place-items: center;
  overflow: hidden;
  width: 84px;
  aspect-ratio: 16 / 10;
  flex: none;
  border-radius: var(--r-md);
  background-color: var(--canvas);
}

.row-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Stands in for a missing cover, so the row keeps its shape either way. */
.row-cover-letter {
  color: var(--ink-3);
  font-size: 20px;
  font-weight: 700;
  line-height: 1;
}

.row-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

/*
  Title and mode chip on one line: the mode qualifies the quiz name, so it shares
  the headline instead of sitting a row below. Wraps if the name is long, in which
  case the chip drops under it rather than squeezing it out.
*/
.row-headline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.row-title {
  min-width: 0;
  flex: 0 1 auto;
  overflow: hidden;
  color: var(--ink);
  font-size: 15.5px;
  font-weight: 600;
  letter-spacing: -0.008em;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Mode, room and time on one wrapping line: all three qualify the same match. */
.row-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  min-width: 0;
  color: var(--ink-3);
  font-size: 12.5px;
  line-height: 1.3;
}

.chip {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: var(--r-full);
  background-color: var(--wash);
  color: var(--ink-2);
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

/* A room that never finished: stated in the answer-A tone, since the scores are partial. */
.chip-warn {
  background-color: var(--ans-a-soft);
  color: var(--ans-a);
}

.row-session {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-dot {
  width: 3px;
  height: 3px;
  flex: none;
  border-radius: var(--r-full);
  background-color: var(--ink-3);
  opacity: 0.6;
}

.row-when {
  flex: none;
}

/* The result of the match, right-aligned so a column of rows compares at a glance. */
.row-score {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex: none;
  gap: 2px;
  padding-left: 8px;
}

.score-value {
  color: var(--ink);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.1;
}

.score-rank,
.score-label {
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
}

.row-go {
  width: 16px;
  height: 16px;
  flex: none;
  color: var(--ink-3);
  transition:
    color var(--t-ui) var(--ease),
    transform var(--t-ui) var(--ease);
}

.history-row:hover .row-go {
  color: var(--spotlight);
  transform: translateX(2px);
}

.sentinel {
  height: 1px;
}

.list-end {
  margin-top: 18px;
  color: var(--ink-3);
  font-size: 12.5px;
  text-align: center;
}

.state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 20px;
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

.state-title {
  color: var(--ink);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.014em;
}

.state-text {
  max-width: 420px;
  margin-top: 8px;
  color: var(--ink-2);
  font-size: 15px;
  line-height: 1.5;
}

/* Row-shaped placeholder: cover block, two text lines, one figure. */
.skeleton-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  background-color: var(--paper);
}

.skeleton-cover {
  display: block;
  width: 84px;
  aspect-ratio: 16 / 10;
  border-radius: var(--r-md);
  background-color: var(--canvas);
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

.skeleton-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.skeleton-line {
  display: block;
  height: 12px;
  border-radius: var(--r-sm);
  background-color: var(--canvas);
  animation: skeleton-pulse 1.4s ease-in-out infinite;
}

.skeleton-line-thin {
  height: 10px;
}

.skeleton-line-score {
  width: 56px;
  height: 20px;
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

/* Below this width the cover and the result cannot share the row with the text. */
@media (max-width: 560px) {
  .history-row {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 12px;
    padding: 12px 14px;
  }

  .row-cover {
    width: 60px;
  }

  .row-go {
    display: none;
  }

  .score-value {
    font-size: 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .history-row,
  .row-go,
  .segment,
  .guest-note-link {
    transition: none;
  }

  .history-row:active {
    transform: none;
  }

  .history-row:hover .row-go {
    transform: none;
  }

  .skeleton-cover,
  .skeleton-line {
    animation: none;
  }
}
</style>
