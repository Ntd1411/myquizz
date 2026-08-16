<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import AuthShell from '@/components/auth/AuthShell.vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import PasswordField from '@/components/base/PasswordField.vue'
import PinInput from '@/components/base/PinInput.vue'
import StateBlock from '@/components/base/StateBlock.vue'
import { resetPassword, resetPasswordWithToken, forgotPassword, verifyResetToken } from '@/api/users.api'
import { useUiStore } from '@/stores/ui.store'
import { toErrorMessage } from '@/api/envelope'
import { revealOnEnter } from '@/composables/useMotion'

/**
 * One route, two ways in:
 *   - The emailed link carries ?token=...: the token is verified against the
 *     backend first, then POST /users/reset-password-token finishes the job.
 *   - Resending a code from the forgot-password page or ProfilePage carries
 *     ?email=...&resetTime=...: POST /users/reset-password with the 6-digit OTP,
 *     that single timestamp driving the resend cooldown below.
 *
 * Neither query param means the page was opened directly, which is not a flow this
 * screen can recover: it sends the reader back to request a fresh link or code.
 */
const ui = useUiStore()
const route = useRoute()
const router = useRouter()

const pageEl = ref(null)

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const mode = computed(() => (token.value ? 'token' : email.value ? 'otp' : 'invalid'))

const otp = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const pending = ref(false)
const formError = ref('')
const resending = ref(false)

// Token links are checked with the backend BEFORE the form is shown: an expired
// or already-used link lands on the error state instead of failing at submit
// time. The check does not consume the token - the real reset re-validates it.
const tokenState = ref('idle')

/*
 * Same countdown behaviour as ForgotPasswordPage: only the resend cooldown is tracked.
 * The backend also answers with the moment the code dies, but that deadline is not
 * surfaced - submitting a dead code fails with a plain error, which says it better than
 * a ticking clock the reader has to race. The cooldown is kept as an absolute deadline
 * read off one ticking clock, which also survives a backgrounded tab throttling it.
 */
const now = ref(Date.now())
const resendAt = ref(0)
let timerId = null

function remainingSeconds(deadline) {
  if (!deadline) return 0
  return Math.max(0, Math.ceil((deadline - now.value) / 1000))
}

const resendIn = computed(() => remainingSeconds(resendAt.value))

const canResend = computed(() => resendIn.value === 0 && !resending.value)

function formatCountdown(seconds) {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

const resendLabel = computed(() => formatCountdown(resendIn.value))

function stopCountdown() {
  if (timerId) {
    clearInterval(timerId)
    timerId = null
  }
}

/** The interval only has to outlive the resend cooldown, so it stops right after it. */
function startCountdown() {
  now.value = Date.now()
  if (timerId) return

  timerId = setInterval(() => {
    now.value = Date.now()
    if (resendIn.value === 0) stopCountdown()
  }, 1000)
}

function toDeadline(value) {
  if (!value) return 0
  const at = new Date(value).getTime()
  return Number.isNaN(at) ? 0 : at
}

/** Takes the deadline the endpoint (or the query string) carries and restarts the clock. */
function applySchedule({ resetTime }) {
  resendAt.value = toDeadline(resetTime)
  if (resendAt.value) startCountdown()
}

onMounted(async () => {
  if (mode.value === 'otp') {
    applySchedule({ resetTime: route.query.resetTime })
  }

  if (mode.value === 'token') {
    tokenState.value = 'verifying'
    try {
      await verifyResetToken(token.value)
      tokenState.value = 'valid'
    } catch {
      tokenState.value = 'invalid'
    }
  }

  revealOnEnter(pageEl.value)
})

onBeforeUnmount(stopCountdown)

async function resendCode() {
  if (!canResend.value) return
  formError.value = ''
  resending.value = true
  try {
    // Only the cooldown deadline is read from the answer; the expiry it also reports
    // stays hidden on purpose.
    applySchedule(await forgotPassword(email.value))
    otp.value = ''
    ui.toast('A new verification code has been sent.')
  } catch (error) {
    formError.value = toErrorMessage(error, 'Could not resend the verification code.')
  } finally {
    resending.value = false
  }
}

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
  if (mode.value === 'otp' && otp.value.length !== 6) {
    formError.value = 'Enter the 6-digit verification code.'
    return
  }

  pending.value = true
  try {
    if (mode.value === 'token') {
      await resetPasswordWithToken({ token: token.value, newPassword: newPassword.value })
    } else {
      await resetPassword({ email: email.value, otp: otp.value, newPassword: newPassword.value })
    }
    stopCountdown()
    ui.toast('Your password has been reset.', 'success')
    router.push({ name: 'login' })
  } catch (error) {
    formError.value = toErrorMessage(
      error,
      mode.value === 'token'
        ? 'This reset link is invalid or has expired.'
        : 'The verification code is invalid or has expired.',
    )
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <AuthShell>
    <div ref="pageEl" class="flex flex-col gap-md" data-enter>
      <StateBlock
        v-if="mode === 'invalid' || (mode === 'token' && tokenState === 'invalid')"
        variant="error"
        icon="🔗"
        :title="mode === 'invalid'
          ? 'This reset link is missing its details'
          : 'This reset link is invalid or has expired'"
        message="Request a new reset email or code and open the link on this device."
      >
        <RouterLink :to="{ name: 'forgot-password' }" class="btn-auth-primary mt-xs">
          Request a new link
        </RouterLink>
      </StateBlock>

      <!-- Token links verify against the backend before the form appears. -->
      <div
        v-else-if="mode === 'token' && tokenState !== 'valid'"
        class="flex flex-col items-center gap-sm py-lg text-body-sm text-ink-muted"
      >
        <BaseSpinner />
        <p>Checking your reset link…</p>
      </div>

      <template v-else>
        <div class="flex flex-col items-center gap-xxs text-center">
          <h1 class="text-heading-2 text-ink">
            Reset password
          </h1>
          <p v-if="mode === 'otp'" class="text-body-sm text-ink-muted">
            Enter the 6-digit code sent to <span class="font-medium text-ink">{{ email }}</span>
            with your new password.
          </p>
          <p v-else class="text-body-sm text-ink-muted">
            Choose a new password for your account.
          </p>
        </div>

        <form class="flex flex-col gap-md" @submit.prevent="submit">
          <div v-if="mode === 'otp'" class="flex flex-col gap-xxs">
            <span class="text-caption font-medium text-ink-2">Verification code</span>
            <PinInput v-model="otp" :length="6" autofocus label="Verification code" />
          </div>

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

          <div v-if="mode === 'otp'" class="flex items-center justify-end text-caption">
            <!-- Unlocked by the shorter cooldown, not by the death of the code. -->
            <button
              class="font-medium text-ink underline-offset-4 transition-opacity duration-150 hover:underline disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline"
              type="button"
              :disabled="!canResend"
              @click="resendCode"
            >
              {{ resendIn > 0 ? `Resend in ${resendLabel}` : 'Resend code' }}
            </button>
          </div>

          <p v-if="formError" class="text-caption text-ans-a" role="alert">
            {{ formError }}
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
