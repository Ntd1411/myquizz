<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AuthShell from '@/components/auth/AuthShell.vue'
import BaseField from '@/components/base/BaseField.vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import PasswordField from '@/components/base/PasswordField.vue'
import { useUiStore } from '@/stores/ui.store'
import { forgotPassword, resetPassword } from '@/api/users.api'
import { toErrorMessage } from '@/api/envelope'

const ui = useUiStore()
const router = useRouter()

// "request" asks for the email, "verify" holds the OTP + new password form.
// Both live on this single page: sending the code only swaps the step.
const step = ref('request')

const email = ref('')
const otp = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

const sending = ref(false)
const resetting = ref(false)
const formError = ref('')

/*
 * POST /users/forgot-password answers with two instants, but only resetTime is used
 * here: it says when a new code may be requested, a minute after the send. The code
 * stays valid longer (expiresAt) and that deadline is deliberately not shown - a dead
 * code already fails with a clear error on submit, so a second countdown would only
 * add noise and pressure. The deadline is kept absolute and re-read from a ticking
 * clock, which keeps the label honest when a backgrounded tab throttles the interval.
 */
const now = ref(Date.now())
const resendAt = ref(0)
let timerId = null

function remainingSeconds(deadline) {
  if (!deadline) return 0
  return Math.max(0, Math.ceil((deadline - now.value) / 1000))
}

const resendIn = computed(() => remainingSeconds(resendAt.value))

const canResend = computed(() => resendIn.value === 0 && !sending.value)

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
  const at = new Date(value).getTime()
  return Number.isNaN(at) ? 0 : at
}

/** Takes the resend deadline the endpoint returns and restarts the clock on it. */
function applySchedule({ resetTime }) {
  resendAt.value = toDeadline(resetTime)
  startCountdown()
}

/**
 * Maps a failed send/resend into a fixed, user-facing message. The backend's own
 * error text is never shown here - it may describe internal rate-limit windows or
 * other details that are not meant for the reader.
 */
function sendCodeErrorMessage(error) {
  const status = error?.response?.status
  if (status === 404) return 'No account uses this email address.'
  if (status === 410) return 'This account has been deactivated.'
  if (status === 400) return 'This account cannot reset its password this way.'
  if (error?.code === 'ERR_NETWORK') return 'Could not connect to the server.'
  return 'Could not send the verification code. Please try again.'
}

async function sendCode() {
  formError.value = ''
  sending.value = true
  try {
    // Asking again during the cooldown is not an error: the backend then sends nothing
    // and answers with the deadlines of the code already outstanding, so this always
    // lands here rather than in the catch block.
    applySchedule(await forgotPassword(email.value))
    step.value = 'verify'
    ui.toast('A verification code has been sent to your email.')
  } catch (error) {
    formError.value = sendCodeErrorMessage(error)
  } finally {
    sending.value = false
  }
}

async function submitReset() {
  formError.value = ''

  if (newPassword.value !== confirmPassword.value) {
    formError.value = 'Password confirmation does not match.'
    return
  }

  resetting.value = true
  try {
    await resetPassword({ email: email.value, otp: otp.value, newPassword: newPassword.value })
    stopCountdown()
    ui.toast('Your password has been reset.')
    router.push({ name: 'login' })
  } catch (error) {
    formError.value = toErrorMessage(error, 'The verification code is invalid or has expired.')
  } finally {
    resetting.value = false
  }
}

function backToEmail() {
  step.value = 'request'
  formError.value = ''
}

onBeforeUnmount(stopCountdown)
</script>

<template>
  <AuthShell>
    <div class="flex flex-col gap-md">
      <div class="flex flex-col items-center gap-xxs text-center">
        <h1 class="text-heading-2 text-ink">
          Forgot password
        </h1>
        <p v-if="step === 'request'" class="text-body-sm text-ink-muted">
          Enter your account email and we will send you a verification code.
        </p>
        <p v-else class="text-body-sm text-ink-muted">
          We sent a 6-digit code to <span class="font-medium text-ink">{{ email }}</span>.
          Enter it below with your new password.
        </p>
      </div>

      <!-- Step 1: ask for the account email. Enter submits natively. -->
      <form v-if="step === 'request'" class="flex flex-col gap-md" @submit.prevent="sendCode">
        <BaseField
          v-model="email"
          label="Email"
          type="email"
          placeholder="m@example.com"
          autocomplete="email"
          required
        />

        <p v-if="formError" class="text-caption text-sticker-orange-deep" role="alert">
          {{ formError }}
        </p>

        <button class="btn-auth-primary w-full" type="submit" :disabled="sending">
          <BaseSpinner v-if="sending" />
          <span>Send code</span>
        </button>
      </form>

      <!-- Step 2: the code arrived, so the reset form takes over. -->
      <form v-else class="flex flex-col gap-md" @submit.prevent="submitReset">
        <BaseField
          v-model="otp"
          label="Verification code"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          required
        />
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

        <div class="flex items-center justify-end text-caption">
          <!-- Resend waits out the cooldown only, not the whole life of the code: a mail
               that never arrived should not cost the reader the full two minutes. -->
          <button
            class="font-medium text-ink underline-offset-4 transition-opacity duration-150 hover:underline disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline"
            type="button"
            :disabled="!canResend"
            @click="sendCode"
          >
            {{ resendIn > 0 ? `Resend in ${resendLabel}` : 'Resend code' }}
          </button>
        </div>

        <p v-if="formError" class="text-caption text-sticker-orange-deep" role="alert">
          {{ formError }}
        </p>

        <button class="btn-auth-primary w-full" type="submit" :disabled="resetting">
          <BaseSpinner v-if="resetting" />
          <span>Reset password</span>
        </button>

        <button class="w-full text-center text-caption text-ink-muted hover:text-ink" type="button" @click="backToEmail">
          Use another email
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
    </div>
  </AuthShell>
</template>
