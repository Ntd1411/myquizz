<script setup>
import { computed, onMounted, ref } from 'vue'
import { banUser, getUsers, unbanUser } from '@/api/admin.api'
import { toErrorMessage } from '@/api/envelope'
import { revealOnEnter } from '@/composables/useMotion'
import { useAuthStore } from '@/stores/auth.store'

/**
 * User administration.
 *
 * Admin only, and guarded twice: the route refuses a non-admin session before the page
 * is ever built, and the API answers 403 regardless of what the browser believes. The
 * page is reachable from the avatar menu and the Admin entry in the navigation, both of
 * which only exist for an admin.
 *
 * Paging is offset based, not cursor based, because that is what /admin/users offers.
 * The list is a fixed window of PAGE_SIZE rows with Previous/Next rather than the
 * infinite scroll the public listings use: an admin reading this screen is looking for
 * one account, so a stable page number is worth more than a growing feed.
 *
 * "Ban" is the backend's soft delete: the row keeps existing but `deleted_at` is set,
 * which is the same state a self-deactivated account ends in, so the person can no
 * longer sign in while their quizzes and match history stay in place. It is reversible,
 * and the listing reports `deleted_at`, so a row's state is read from the server rather
 * than remembered here.
 */

const PAGE_SIZE = 20

// Mirrors USER_STATUS_FILTERS on the server. `total` is counted through the same
// filter, so the pager stays correct in every one of them.
const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'banned', label: 'Banned' },
]

const EMPTY_TEXT = {
  all: 'There are no accounts to show.',
  active: 'Every account is currently banned.',
  banned: 'No account has been banned.',
}

const auth = useAuthStore()
const pageEl = ref(null)

const users = ref([])
const total = ref(0)
const offset = ref(0)
const status = ref('all')
const loading = ref(true)
const errorMessage = ref('')

// The row whose ban or unban is in flight, so only its own button shows the wait.
const pendingId = ref(null)
// A refused ban or unban. Kept next to the table rather than in the row, which is
// about to be replaced by the refetch.
const actionError = ref('')

// The account the confirmation dialog is about, or null while it is closed.
const confirming = ref(null)
const banPending = ref(false)
const banError = ref('')

const pageNumber = computed(() => Math.floor(offset.value / PAGE_SIZE) + 1)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const hasPrev = computed(() => offset.value > 0)
const hasNext = computed(() => offset.value + users.value.length < total.value)

const isEmpty = computed(
  () => !loading.value && !errorMessage.value && users.value.length === 0,
)

const countLabel = computed(() => {
  if (loading.value || errorMessage.value) return ''
  return `${total.value} ${total.value === 1 ? 'account' : 'accounts'}`
})

async function load() {
  loading.value = true
  errorMessage.value = ''

  try {
    const page = await getUsers({
      offset: offset.value,
      limit: PAGE_SIZE,
      status: status.value,
    })
    users.value = page.users
    total.value = page.pagination.total

    /*
     * Banning the last row of the last page (while the Active filter is on) leaves the
     * window past the end of the list, which would render as "nothing here" on a list
     * that is not empty. One step back and a single retry fixes it; `offset` is always
     * a multiple of PAGE_SIZE, so this cannot loop.
     */
    if (users.value.length === 0 && offset.value > 0) {
      offset.value = Math.max(0, offset.value - PAGE_SIZE)
      const previous = await getUsers({
        offset: offset.value,
        limit: PAGE_SIZE,
        status: status.value,
      })
      users.value = previous.users
      total.value = previous.pagination.total
    }
  } catch (error) {
    users.value = []
    errorMessage.value = toErrorMessage(error, 'Could not load the user list.')
  } finally {
    loading.value = false
  }
}

function goToPage(nextOffset) {
  if (nextOffset === offset.value || nextOffset < 0) return
  offset.value = nextOffset
  actionError.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
  load()
}

// Changing the filter changes which rows exist, so paging starts over rather than
// keeping an offset that meant something else.
function setStatus(next) {
  if (next === status.value) return
  status.value = next
  offset.value = 0
  actionError.value = ''
  load()
}

function isBanned(user) {
  return Boolean(user.deleted_at)
}

// An admin must not lock themselves out, so their own row carries no ban control. The
// backend refuses it too, with ADMIN_CANNOT_BAN_SELF.
function isSelf(user) {
  return user.id === auth.user?.id
}

function askBan(user) {
  if (isSelf(user) || isBanned(user)) return
  banError.value = ''
  confirming.value = user
}

function closeConfirm() {
  if (banPending.value) return
  confirming.value = null
  banError.value = ''
}

async function confirmBan() {
  const target = confirming.value
  if (!target || banPending.value) return

  banPending.value = true
  banError.value = ''

  try {
    await banUser(target.id)
    confirming.value = null
    // Refetched rather than patched in place: under the Active filter the row leaves
    // the page entirely, and `total` moves with it.
    await load()
  } catch (error) {
    banError.value = toErrorMessage(error, 'Could not ban this account.')
  } finally {
    banPending.value = false
  }
}

// Lifting a ban restores access rather than removing anything, so it is not confirmed.
async function liftBan(user) {
  if (pendingId.value) return

  pendingId.value = user.id
  actionError.value = ''

  try {
    await unbanUser(user.id)
    await load()
  } catch (error) {
    actionError.value = toErrorMessage(error, 'Could not lift this ban.')
  } finally {
    pendingId.value = null
  }
}

function dateLabel(value) {
  if (!value) return '—'
  const stamp = new Date(value)
  return Number.isNaN(stamp.getTime()) ? '—' : stamp.toLocaleDateString()
}

function dateTitle(value) {
  if (!value) return ''
  const stamp = new Date(value)
  return Number.isNaN(stamp.getTime()) ? '' : stamp.toLocaleString()
}

function initial(user) {
  const name = user.fullname || user.email || '?'
  return name.trim().charAt(0).toUpperCase() || '?'
}

onMounted(() => {
  revealOnEnter(pageEl.value)
  load()
})
</script>

<template>
  <div ref="pageEl" class="container-page pb-xxl pt-lg">
    <!--
      One line for the two things that describe the list as a whole: what a ban does,
      and how many accounts the current filter matches. No page heading: this screen is
      only reachable from an Admin entry that already says where the reader is, so
      repeating it here only pushed the table down.
    -->
    <div class="admin-bar" data-enter>
      <p class="admin-note">
        <span class="admin-note-icon" aria-hidden="true">
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
          Banning deactivates the account: the person can no longer sign in, while their
          quizzes and match history stay in place. It can be lifted again from this screen.
        </span>
      </p>
      <span v-if="countLabel" class="admin-count num">{{ countLabel }}</span>
    </div>

    <div class="filters" role="group" aria-label="Filter accounts" data-enter>
      <button
        v-for="filter in FILTERS"
        :key="filter.value"
        class="filter-btn"
        :class="status === filter.value ? 'is-active' : ''"
        type="button"
        :aria-pressed="status === filter.value"
        @click="setStatus(filter.value)"
      >
        {{ filter.label }}
      </button>
    </div>

    <p v-if="actionError" class="action-error" role="alert">
      {{ actionError }}
    </p>

    <!-- Skeletons carry the shape of a row, so the table does not jump when it lands. -->
    <div v-if="loading" class="admin-card">
      <div v-for="n in 6" :key="`skeleton-${n}`" class="skeleton-row">
        <span class="skeleton-avatar" />
        <span class="skeleton-body">
          <span class="skeleton-line" style="width: 38%" />
          <span class="skeleton-line skeleton-line-thin" style="width: 24%" />
        </span>
        <span class="skeleton-line skeleton-line-action" />
      </div>
    </div>

    <div v-else-if="errorMessage" class="state-card is-error">
      <p class="state-title">
        This did not load
      </p>
      <p class="state-text">
        {{ errorMessage }}
      </p>
      <button class="btn-utility mt-md" type="button" @click="load">
        Try again
      </button>
    </div>

    <div v-else-if="isEmpty" class="state-card">
      <p class="state-title">
        Nothing to show
      </p>
      <p class="state-text">
        {{ EMPTY_TEXT[status] }}
      </p>
    </div>

    <template v-else>
      <div class="admin-card">
        <!--
          A table on wide screens, stacked rows below it. The header is hidden rather
          than removed on narrow screens, so each cell keeps its own label instead.
        -->
        <div class="admin-row admin-row-head" aria-hidden="true">
          <span>Account</span>
          <span>Phone</span>
          <span>Role</span>
          <span>Joined</span>
          <span />
        </div>

        <ul class="admin-list">
          <li
            v-for="user in users"
            :key="user.id"
            class="admin-row"
            :class="isBanned(user) ? 'is-banned' : ''"
          >
            <span class="cell-account">
              <span class="avatar">
                <img v-if="user.avatar" :src="user.avatar" alt="" loading="lazy">
                <span v-else class="avatar-letter" aria-hidden="true">{{ initial(user) }}</span>
              </span>
              <span class="account-main">
                <span class="account-headline">
                  <RouterLink
                    class="account-name"
                    :to="{ name: 'user-profile', params: { id: user.id } }"
                  >
                    {{ user.fullname || 'Unnamed account' }}
                  </RouterLink>
                  <span v-if="isSelf(user)" class="chip">You</span>
                  <span
                    v-if="isBanned(user)"
                    class="chip chip-warn"
                    :title="`Banned on ${dateTitle(user.deleted_at)}`"
                  >
                    Banned
                  </span>
                </span>
                <span class="account-email">{{ user.email }}</span>
              </span>
            </span>

            <span class="cell" data-label="Phone">
              {{ user.phone || '—' }}
            </span>

            <span class="cell" data-label="Role">
              <span class="chip" :class="user.role === 'admin' ? 'chip-role' : ''">
                {{ user.role || 'user' }}
              </span>
            </span>

            <span class="cell num" data-label="Joined" :title="dateTitle(user.created_at)">
              {{ dateLabel(user.created_at) }}
            </span>

            <span class="cell-action">
              <!-- An admin cannot ban themselves, so the control is absent, not disabled. -->
              <span v-if="isSelf(user)" class="action-note">—</span>
              <button
                v-else-if="isBanned(user)"
                class="btn-utility btn-row"
                type="button"
                :disabled="pendingId === user.id"
                @click="liftBan(user)"
              >
                {{ pendingId === user.id ? 'Lifting…' : 'Unban' }}
              </button>
              <button v-else class="btn-danger" type="button" @click="askBan(user)">
                Ban
              </button>
            </span>
          </li>
        </ul>
      </div>

      <div class="pager">
        <button
          class="btn-utility"
          type="button"
          :disabled="!hasPrev"
          @click="goToPage(offset - PAGE_SIZE)"
        >
          Previous
        </button>
        <span class="pager-label num">Page {{ pageNumber }} of {{ pageCount }}</span>
        <button
          class="btn-utility"
          type="button"
          :disabled="!hasNext"
          @click="goToPage(offset + PAGE_SIZE)"
        >
          Next
        </button>
      </div>
    </template>

    <!--
      Banning cuts off access, so it is confirmed by name and email rather than by a row
      position the pointer could have slipped on. Unbanning restores access and needs no
      such step.
    -->
    <Teleport to="body">
      <div v-if="confirming" class="modal-backdrop" @click.self="closeConfirm">
        <div
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ban-title"
          @keydown.esc="closeConfirm"
        >
          <h2 id="ban-title" class="modal-title">
            Ban this account?
          </h2>
          <p class="modal-text">
            <strong>{{ confirming.fullname || 'Unnamed account' }}</strong>
            ({{ confirming.email }}) will no longer be able to sign in. You can lift the
            ban again from this screen.
          </p>

          <p v-if="banError" class="modal-error" role="alert">
            {{ banError }}
          </p>

          <div class="modal-actions">
            <button class="btn-utility" type="button" :disabled="banPending" @click="closeConfirm">
              Cancel
            </button>
            <button class="btn-danger" type="button" :disabled="banPending" @click="confirmBan">
              {{ banPending ? 'Banning…' : 'Ban account' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* The note and the count sit on one line; the count drops under it when space runs out. */
.admin-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
}

.admin-count {
  margin-left: auto;
  flex: none;
  color: var(--ink-3);
  font-size: 13px;
  white-space: nowrap;
}

/* A standing condition of the screen, so it is a quiet note rather than an alert. */
.admin-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex: 1 1 42ch;
  min-width: 0;
  max-width: 72ch;
  padding: 12px 16px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  background-color: var(--canvas);
  color: var(--ink-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.admin-note-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 20px;
  height: 20px;
  margin-top: 1px;
  color: var(--spotlight);
}

.admin-note-icon svg {
  width: 18px;
  height: 18px;
}

.filters {
  display: flex;
  gap: 6px;
  margin-top: 16px;
}

.filter-btn {
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-full);
  background-color: var(--paper);
  color: var(--ink-2);
  font-size: 13.5px;
  font-weight: 600;
  transition:
    background-color var(--t-ui) var(--ease),
    border-color var(--t-ui) var(--ease),
    color var(--t-ui) var(--ease);
}

.filter-btn:hover {
  border-color: var(--ink-3);
  color: var(--ink);
}

.filter-btn.is-active {
  border-color: var(--ink);
  background-color: var(--ink);
  color: var(--paper);
}

.action-error {
  margin-top: 16px;
  padding: 10px 14px;
  border: 1px solid var(--ans-a);
  border-radius: var(--r-md);
  background-color: var(--ans-a-soft);
  color: var(--ans-a);
  font-size: 13.5px;
}

.admin-card {
  overflow: hidden;
  margin-top: 20px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  background-color: var(--paper);
}

.admin-list {
  list-style: none;
}

.admin-row {
  display: grid;
  /*
   * Every track is content-independent on purpose. The header and each row are
   * separate grid containers, so an `auto` or fr track sized against content resolves
   * per row - which is what made the ROLE and JOINED headers sit away from the values
   * underneath them. Fixed widths make every row compute identically.
   */
  grid-template-columns: minmax(0, 2.4fr) minmax(0, 1fr) 104px 104px 92px;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border-top: 1px solid var(--hairline);
}

.admin-row-head {
  border-top: 0;
  background-color: var(--canvas);
  color: var(--ink-3);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.admin-list .admin-row:first-child {
  border-top: 1px solid var(--hairline);
}

/* A banned row stays readable but stops competing for attention. */
.admin-row.is-banned {
  background-color: var(--wash);
}

.admin-row.is-banned .account-name,
.admin-row.is-banned .cell {
  color: var(--ink-3);
}

.cell-account {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.avatar {
  display: grid;
  place-items: center;
  overflow: hidden;
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: var(--r-full);
  background-color: var(--canvas);
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-letter {
  color: var(--ink-3);
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
}

.account-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.account-headline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.account-name {
  min-width: 0;
  overflow: hidden;
  color: var(--ink);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.008em;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-name:hover {
  color: var(--spotlight);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.account-email {
  min-width: 0;
  overflow: hidden;
  color: var(--ink-3);
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell {
  min-width: 0;
  overflow: hidden;
  color: var(--ink-2);
  font-size: 13.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-action {
  display: flex;
  justify-content: flex-end;
  flex: none;
}

.action-note {
  color: var(--ink-3);
  font-size: 12.5px;
}

.btn-row {
  height: 32px;
  padding: 0 14px;
  font-size: 13.5px;
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
  text-transform: capitalize;
}

.chip-role {
  background-color: var(--spotlight-line);
  color: var(--spotlight);
}

.chip-warn {
  background-color: var(--ans-a-soft);
  color: var(--ans-a);
  text-transform: none;
}

/* Destructive action: outlined until it is hovered, so it never reads as the default. */
.btn-danger {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--ans-a);
  border-radius: var(--r-md);
  background-color: transparent;
  color: var(--ans-a);
  font-size: 13.5px;
  font-weight: 600;
  transition:
    background-color var(--t-ui) var(--ease),
    color var(--t-ui) var(--ease);
}

.btn-danger:hover:not(:disabled) {
  background-color: var(--ans-a);
  color: #fff;
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}

.pager-label {
  color: var(--ink-3);
  font-size: 13px;
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

.skeleton-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border-top: 1px solid var(--hairline);
}

.skeleton-row:first-child {
  border-top: 0;
}

.skeleton-avatar {
  display: block;
  width: 38px;
  height: 38px;
  border-radius: var(--r-full);
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

.skeleton-line-action {
  width: 62px;
  height: 30px;
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

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 20px;
  background-color: rgb(0 0 0 / 40%);
}

.modal {
  width: 100%;
  max-width: 420px;
  padding: 24px;
  border-radius: var(--r-lg);
  background-color: var(--paper);
  box-shadow: var(--sh-1);
}

.modal-title {
  color: var(--ink);
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.014em;
}

.modal-text {
  margin-top: 10px;
  color: var(--ink-2);
  font-size: 14.5px;
  line-height: 1.5;
}

.modal-error {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: var(--r-md);
  background-color: var(--ans-a-soft);
  color: var(--ans-a);
  font-size: 13.5px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

/* Below this width the five columns cannot share a line, so each cell labels itself. */
@media (max-width: 860px) {
  .admin-row-head {
    display: none;
  }

  .admin-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px 12px;
  }

  .cell-account {
    grid-column: 1;
  }

  .cell-action {
    grid-column: 2;
    grid-row: 1;
  }

  .cell {
    grid-column: 1 / -1;
    display: flex;
    gap: 8px;
    white-space: normal;
  }

  .cell::before {
    content: attr(data-label);
    flex: none;
    min-width: 56px;
    color: var(--ink-3);
    font-size: 12px;
    font-weight: 600;
  }
}

@media (prefers-reduced-motion: reduce) {
  .btn-danger,
  .filter-btn {
    transition: none;
  }

  .skeleton-avatar,
  .skeleton-line {
    animation: none;
  }
}
</style>
