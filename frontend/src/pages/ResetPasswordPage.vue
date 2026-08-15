<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import BaseField from '@/components/base/BaseField.vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import BrandLogo from '@/components/base/BrandLogo.vue'
import PinInput from '@/components/base/PinInput.vue'
import StateBlock from '@/components/base/StateBlock.vue'
import { resetPassword, resetPasswordWithToken, forgotPassword } from '@/api/users.api'
import { useUiStore } from '@/stores/ui.store'
import { toErrorMessage } from '@/api/envelope'
import { revealOnEnter } from '@/composables/useMotion'

/**
 * One route, two ways in:
 *   - The emailed link carries ?token=...: POST /users/reset-password-token.
 *   - Resending a code from the forgot-password page or ProfilePage carries
 *     ?email=...&resetTime=...: POST /users/reset-password with the 6-digit OTP.
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

// Same countdown behaviour as ForgotPasswordPage: resend stays disabled until the
// current code actually expires, because the backend answers an early retry with 429.
const secondsLeft = ref(0)
let timerId = null

const canResend = computed(() => secondsLeft.value === 0 && !resending.value)

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
  if (!resetTime) return
  const expiresAt = new Date(resetTime).getTime()
  if (Number.isNaN(expiresAt)) return
  startCountdown((expiresAt - Date.now()) / 1000)
}

onMounted(() => {
  if (mode.value === 'otp') startCountdownFromResetTime(route.query.resetTime)
  revealOnEnter(pageEl.value)
})

onBeforeUnmount(stopCountdown)

async function resendCode() {
  if (!canResend.value) return
  formError.value = ''
  resending.value = true
  try {
    const resetTime = await forgotPassword(email.value)
    startCountdownFromResetTime(resetTime)
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
  <div ref="pageEl" class="container-page flex justify-center py-xxl">
    <div class="card-surface w-full max-w-md p-lg" data-enter>
      <BrandLogo class="mb-md" :size="24" />

      <StateBlock
        v-if="mode === 'invalid'"
        variant="error"
        icon="\u{1F517}"
        title="This reset link is missing its details"
        message="Request a new reset email or code and open the link on this device."
      >
        <RouterLink :to="{ name: 'forgot-password' }" class="btn-primary mt-xs">
          Request a new link
        </RouterLink>
      </StateBlock>

      <template v-else>
        <h1 class="text-heading-2 text-ink">
          Reset password
        </h1>

        <p v-if="mode === 'otp'" class="mt-xxs text-body-sm text-ink-muted">
          Enter the 6-digit code sent to <span class="font-medium text-ink">{{ email }}</span>
          with your new password.
        </p>
        <p v-else class="mt-xxs text-body-sm text-ink-muted">
          Choose a new password for your account.
        </p>

        <form class="mt-lg flex flex-col gap-sm" @submit.prevent="submit">
          <div v-if="mode === 'otp'" class="flex flex-col gap-xxs">
            <span class="text-caption font-medium text-ink-2">Verification code</span>
            <PinInput v-model="otp" :length="6" autofocus label="Verification code" />
          </div>

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

          <div v-if="mode === 'otp'" class="flex items-center justify-between text-caption">
            <span v-if="secondsLeft > 0" class="text-ink-muted">
              Code expires in <span class="font-semibold text-ink tabular-nums">{{ countdownLabel }}</span>
            </span>
            <span v-else class="text-sticker-orange-deep">The code has expired.</span>

            <button
              class="font-medium text-primary transition-opacity duration-150 hover:text-primary-active disabled:cursor-not-allowed disabled:text-ink-faint"
              type="button"
              :disabled="!canResend"
              @click="resendCode"
            >
              Resend code
            </button>
          </div>

          <p v-if="formError" class="text-caption text-ans-a" role="alert">
            {{ formError }}
          </p>

          <button class="btn-primary mt-xs" type="submit" :disabled="pending">
            <BaseSpinner v-if="pending" />
            <span>Reset password</span>
          </button>
        </form>

        <div class="mt-md text-caption">
          <RouterLink :to="{ name: 'login' }" class="text-primary hover:text-primary-active">
            Back to log in
          </RouterLink>
        </div>
      </template>
    </div>
  </div>
</template>
