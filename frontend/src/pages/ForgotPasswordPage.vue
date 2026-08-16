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

// The backend answers POST /users/forgot-password with { resetTime }: the instant
// the current OTP expires. Re-sending to the same email while it is still valid
// does not send a new email or throw - it just echoes back this same expiry, so
// the countdown here always reflects the one real OTP outstanding.
const secondsLeft = ref(0)
let timerId = null

const canResend = computed(() => secondsLeft.value === 0 && !sending.value)

const countdownLabel = computed(() => {
  const minutes = Math.floor(secondsLeft.value / 60)
  const seconds = secondsLeft.value % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
})

function stopCountdown() {
  if (timerId) {
    clearInterval(timerId)
    timerId = null
  }
}

/** Ticks once per second down to zero, then re-enables the resend button. */
function startCountdown(seconds) {
  stopCountdown()
  secondsLeft.value = Math.max(0, Math.floor(seconds))
  if (secondsLeft.value === 0) return

  timerId = setInterval(() => {
    secondsLeft.value -= 1
    if (secondsLeft.value <= 0) stopCountdown()
  }, 1000)
}

function startCountdownFromResetTime(resetTime) {
  const expiresAt = new Date(resetTime).getTime()
  if (Number.isNaN(expiresAt)) return
  startCountdown((expiresAt - Date.now()) / 1000)
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
    // Re-requesting a code for an email that already has one outstanding is not an
    // error: the backend just hands back the same expiry instead of resending the
    // email, so this always lands here rather than in the catch block.
    const { resetTime } = await forgotPassword(email.value)
    startCountdownFromResetTime(resetTime)
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

        <div class="flex items-center justify-between text-caption">
          <span v-if="secondsLeft > 0" class="text-ink-muted">
            Code expires in <span class="font-semibold text-ink tabular-nums">{{ countdownLabel }}</span>
          </span>
          <span v-else class="text-sticker-orange-deep">The code has expired.</span>

          <!-- Resend stays disabled while the current code is still valid. Clicking it
               early would just re-fetch the same expiry without sending a new email. -->
          <button
            class="font-medium text-ink underline-offset-4 transition-opacity duration-150 hover:underline disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline"
            type="button"
            :disabled="!canResend"
            @click="sendCode"
          >
            Resend code
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
