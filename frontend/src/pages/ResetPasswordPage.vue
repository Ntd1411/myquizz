<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import AuthShell from '@/components/auth/AuthShell.vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import PasswordField from '@/components/base/PasswordField.vue'
import StateBlock from '@/components/base/StateBlock.vue'
import { verifyResetLink, getResetTicket, completeReset } from '@/api/users.api'
import { saveResetTicket, loadResetTicket, clearResetTicket } from '@/utils/resetTicket'
import { toErrorMessage } from '@/api/envelope'
import { revealOnEnter } from '@/composables/useMotion'

/**
 * Last step of a reset: the new password, and nothing else. No code and no emailed
 * token reach this screen - it works purely with the ticket handed out by
 * POST /users/password-reset/verify, which is also the only thing
 * POST /users/password-reset/complete accepts.
 *
 * Two ways in, and both end up holding a ticket:
 *   - /reset-password       the code was verified on the forgot-password screen, which
 *                           left the ticket in sessionStorage for this tab.
 *   - /reset-password/link  the emailed link, carrying ?token=...: the token is
 *                           exchanged for a ticket here and then dropped from the URL,
 *                           because it is spent and a bookmark of it would only ever
 *                           land on the error state below.
 *
 * The ticket is read back from the server before the form appears, so a session that
 * expired says so instead of failing after the password has been typed twice.
 */
const route = useRoute()
const router = useRouter()

const pageEl = ref(null)

// 'checking' | 'ready' | 'invalid'
const state = ref('checking')

// Masked by the backend (de**@myquizz.com), so it can be shown without printing the
// address to whoever opened the link.
const maskedEmail = ref('')

const newPassword = ref('')
const confirmPassword = ref('')
const pending = ref(false)
const formError = ref('')

/*
 * A ticket lives ten minutes, which is long enough to be worth showing: unlike the
 * two-minute code it is not something to race, and knowing there is a deadline is
 * better than being logged out of a half-typed form without warning. It is kept as an
 * absolute instant and read off one ticking clock, so a throttled background tab does
 * not drift.
 */
const now = ref(Date.now())
const expiresAt = ref(0)
let timerId = null

const remaining = computed(() => {
  if (!expiresAt.value) return 0
  return Math.max(0, Math.ceil((expiresAt.value - now.value) / 1000))
})

const remainingLabel = computed(() => {
  const minutes = Math.floor(remaining.value / 60)
  return `${minutes}:${String(remaining.value % 60).padStart(2, '0')}`
})

function stopCountdown() {
  if (timerId) {
    clearInterval(timerId)
    timerId = null
  }
}

function expire() {
  stopCountdown()
  clearResetTicket()
  state.value = 'invalid'
}

/** Runs only while the ticket is alive, and turns into the error state when it dies. */
function startCountdown() {
  now.value = Date.now()
  if (timerId) return

  timerId = setInterval(() => {
    now.value = Date.now()
    if (remaining.value === 0) expire()
  }, 1000)
}

function toDeadline(value) {
  if (!value) return 0
  const at = new Date(value).getTime()
  return Number.isNaN(at) ? 0 : at
}

const isLinkMode = computed(() => route.name === 'reset-password-link')

onMounted(async () => {
  revealOnEnter(pageEl.value)

  if (isLinkMode.value) {
    const token = typeof route.query.token === 'string' ? route.query.token : ''
    if (!token) {
      state.value = 'invalid'
      return
    }

    try {
      saveResetTicket(await verifyResetLink(token))
      // The token is spent now, so it leaves the address bar and the plain reset route
      // takes over from the stored ticket.
      router.replace({ name: 'reset-password' })
    } catch {
      state.value = 'invalid'
    }
    return
  }

  const stored = loadResetTicket()
  if (!stored) {
    state.value = 'invalid'
    return
  }

  try {
    // Reading the ticket does not spend it; it only says whether it is still alive and
    // which address it belongs to.
    const status = await getResetTicket(stored.ticket)
    maskedEmail.value = status.email || stored.email
    expiresAt.value = toDeadline(status.expiresAt)
    state.value = 'ready'
    if (expiresAt.value) startCountdown()
  } catch {
    clearResetTicket()
    state.value = 'invalid'
  }
})

onBeforeUnmount(stopCountdown)

async function submit() {
  formError.value = ''

  if (newPassword.value.length < 8) {
    formError.value = 'New password must be at least 8 characters.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    formError.value = 'Password confirmation does not match.'
    return
  }

  const stored = loadResetTicket()
  if (!stored) {
    expire()
    return
  }

  pending.value = true
  try {
    await completeReset({ ticket: stored.ticket, newPassword: newPassword.value })
    // The ticket is single use, so nothing is left to keep, and every device was signed
    // out server side: logging in again is the only way on from here.
    clearResetTicket()
    stopCountdown()
    router.push({ name: 'login', query: { reason: 'password-reset' } })
  } catch (error) {
    // Which of the three refusals happened is read off the error code - a spent
    // ticket, a password identical to the current one, a deactivated account - and
    // turned into our own sentence, printed under the form the reader just used.
    formError.value = toErrorMessage(error, 'Could not reset your password.')
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <AuthShell>
    <div ref="pageEl" class="flex flex-col gap-md" data-enter>
      <StateBlock
        v-if="state === 'invalid'"
        variant="error"
        icon="🔗"
        title="This reset session has expired"
        message="Reset links and codes are single use and short lived. Request a new one and finish the reset in the tab you started it in."
      >
        <RouterLink :to="{ name: 'forgot-password' }" class="btn-auth-primary mt-xs">
          Request a new code
        </RouterLink>
      </StateBlock>

      <!-- The ticket is checked with the backend before any field is shown. -->
      <div
        v-else-if="state === 'checking'"
        class="flex flex-col items-center gap-sm py-lg text-body-sm text-ink-muted"
      >
        <BaseSpinner />
        <p>Checking your reset session…</p>
      </div>

      <template v-else>
        <div class="flex flex-col items-center gap-xxs text-center">
          <h1 class="text-heading-2 text-ink">
            Choose a new password
          </h1>
          <p class="text-body-sm text-ink-muted">
            For the account
            <span class="font-medium text-ink" v-text="maskedEmail" />.
            Every device will be signed out.
          </p>
          <p v-if="remaining > 0" class="text-caption text-ink-faint">
            Finish within <span v-text="remainingLabel" />
          </p>
        </div>

        <form class="flex flex-col gap-md" @submit.prevent="submit">
          <PasswordField
            v-model="newPassword"
            label="New password"
            autocomplete="new-password"
            required
          />
          <PasswordField
            v-model="confirmPassword"
            label="Confirm new password"
            autocomplete="new-password"
            required
          />

          <p v-if="formError" class="text-caption text-ans-a" role="alert">
            <span v-text="formError" />
          </p>

          <button class="btn-auth-primary w-full" type="submit" :disabled="pending">
            <BaseSpinner v-if="pending" />
            <span>Reset password</span>
          </button>
        </form>

        <p class="text-center text-caption text-ink-muted">
          Remembered it after all?
          <RouterLink
            :to="{ name: 'login' }"
            class="font-medium text-ink underline-offset-4 hover:underline"
          >
            Back to log in
          </RouterLink>
        </p>
      </template>
    </div>
  </AuthShell>
</template>
