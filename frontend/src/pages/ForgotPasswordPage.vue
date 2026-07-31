<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import BaseField from '@/components/base/BaseField.vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import BrandLogo from '@/components/base/BrandLogo.vue'
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
// the OTP expires. A new code can only be requested once that window is over,
// because the server rejects an earlier retry with 429.
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
 * A 429 means an OTP is still alive; the message carries the remaining TTL, so the
 * countdown can be restored instead of leaving the button permanently enabled.
 */
function startCountdownFromError(error) {
  const message = error?.response?.data?.message ?? ''
  const match = /(\d+)\s*second/i.exec(message)
  if (match) startCountdown(Number(match[1]))
}

async function sendCode() {
  formError.value = ''
  sending.value = true
  try {
    const { resetTime } = await forgotPassword(email.value)
    startCountdownFromResetTime(resetTime)
    step.value = 'verify'
    ui.toast('A verification code has been sent to your email.')
  } catch (error) {
    if (error?.response?.status === 429) {
      // The previous code is still valid, so let the user type it in.
      startCountdownFromError(error)
      step.value = 'verify'
    }
    formError.value = toErrorMessage(error, 'Could not send the verification code.')
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
  <div class="container-page flex justify-center py-xxl">
    <div class="card-surface w-full max-w-md p-lg">
      <BrandLogo class="mb-md" :size="24" />

      <h1 class="text-heading-2 text-ink">
        Forgot password
      </h1>

      <!-- Step 1: ask for the account email. -->
      <template v-if="step === 'request'">
        <p class="mt-xxs text-body-sm text-ink-muted">
          Enter your account email and we will send you a verification code.
        </p>

        <form class="mt-lg flex flex-col gap-sm" @submit.prevent="sendCode">
          <BaseField
            v-model="email"
            label="Email"
            type="email"
            autocomplete="email"
            required
          />

          <p v-if="formError" class="text-caption text-sticker-orange-deep">
            {{ formError }}
          </p>

          <button class="btn-primary mt-xs" type="submit" :disabled="sending">
            <BaseSpinner v-if="sending" />
            <span>Send code</span>
          </button>
        </form>
      </template>

      <!-- Step 2: the code arrived, so the reset form takes over the same card. -->
      <template v-else>
        <p class="mt-xxs text-body-sm text-ink-muted">
          We sent a 6-digit code to <span class="font-medium text-ink">{{ email }}</span>.
          Enter it below with your new password.
        </p>

        <form class="mt-lg flex flex-col gap-sm" @submit.prevent="submitReset">
          <BaseField
            v-model="otp"
            label="Verification code"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            required
          />
          <BaseField
            v-model="newPassword"
            label="New password"
            type="password"
            autocomplete="new-password"
            required
          />
          <BaseField
            v-model="confirmPassword"
            label="Confirm new password"
            type="password"
            autocomplete="new-password"
            required
          />

          <div class="flex items-center justify-between text-caption">
            <span v-if="secondsLeft > 0" class="text-ink-muted">
              Code expires in <span class="font-semibold text-ink tabular-nums">{{ countdownLabel }}</span>
            </span>
            <span v-else class="text-sticker-orange-deep">The code has expired.</span>

            <!-- Resend stays disabled while the current code is still valid: the
                 backend answers 429 until the OTP window is over. -->
            <button
              class="font-medium text-primary transition-opacity duration-150 hover:text-primary-active disabled:cursor-not-allowed disabled:text-ink-faint"
              type="button"
              :disabled="!canResend"
              @click="sendCode"
            >
              Resend code
            </button>
          </div>

          <p v-if="formError" class="text-caption text-sticker-orange-deep">
            {{ formError }}
          </p>

          <button class="btn-primary mt-xs" type="submit" :disabled="resetting">
            <BaseSpinner v-if="resetting" />
            <span>Reset password</span>
          </button>

          <button class="btn-ghost" type="button" @click="backToEmail">
            Use another email
          </button>
        </form>
      </template>

      <div class="mt-md text-caption">
        <RouterLink :to="{ name: 'login' }" class="text-primary hover:text-primary-active">
          Back to log in
        </RouterLink>
      </div>
    </div>
  </div>
</template>
