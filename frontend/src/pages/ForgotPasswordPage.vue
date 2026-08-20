<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AuthShell from '@/components/auth/AuthShell.vue'
import BaseField from '@/components/base/BaseField.vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import PinInput from '@/components/base/PinInput.vue'
import { useUiStore } from '@/stores/ui.store'
import { forgotPassword, verifyResetCode } from '@/api/users.api'
import { saveResetTicket } from '@/utils/resetTicket'
import { toErrorMessage } from '@/api/envelope'

/**
 * Steps one and two of a reset: ask for the code, then prove the email arrived.
 * The new password is NOT typed here.
 *
 * That split follows the backend: the six-digit code is exchanged at
 * POST /users/password-reset/verify for a ticket, and only that ticket can write a
 * password. So the code is spent while it is still fresh - it only has two minutes -
 * and the reader then gets ten calm minutes on the next screen to think of a password,
 * instead of racing a dying code with a form half filled in.
 *
 * ProfilePage can also land here already on the code step: it has an address and has
 * just asked for a code, so it hands both over through the query string.
 */
const ui = useUiStore()
const route = useRoute()
const router = useRouter()

// 'request' asks for the email, 'verify' holds the 6-digit code.
const step = ref('request')

const email = ref(typeof route.query.email === 'string' ? route.query.email : '')
const otp = ref('')

const sending = ref(false)
const verifying = ref(false)
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

const resendLabel = computed(() =>
  resendIn.value > 0 ? `Resend in ${formatCountdown(resendIn.value)}` : 'Resend code',
)

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

/** Takes the resend deadline the endpoint returns and restarts the clock on it. */
function applySchedule({ resetTime }) {
  resendAt.value = toDeadline(resetTime)
  if (resendAt.value) startCountdown()
}

// ProfilePage already sent the code, so this opens straight on the code step and
// keeps its cooldown rather than sending a second mail on arrival.
onMounted(() => {
  if (email.value && route.query.resetTime) {
    applySchedule({ resetTime: route.query.resetTime })
    step.value = 'verify'
  }
})

onBeforeUnmount(stopCountdown)

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
  if (status === 429) return 'Too many attempts. Please try again in a few minutes.'
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
    otp.value = ''
    step.value = 'verify'
    ui.toast('A verification code has been sent to your email.')
  } catch (error) {
    formError.value = sendCodeErrorMessage(error)
  } finally {
    sending.value = false
  }
}

/**
 * Exchanges the code for a ticket and hands that ticket to the reset screen through
 * sessionStorage, never through the URL: a credential in a link ends up in history and
 * in referrers, which is the very thing the ticket step exists to avoid.
 */
async function submitCode() {
  formError.value = ''

  if (otp.value.length !== 6) {
    formError.value = 'Enter the 6-digit verification code.'
    return
  }

  verifying.value = true
  try {
    saveResetTicket(await verifyResetCode({ email: email.value, otp: otp.value }))
    stopCountdown()
    router.push({ name: 'reset-password' })
  } catch (error) {
    // A wrong code is worth clearing: the next attempt starts from an empty row, and
    // five wrong ones kill the code server side anyway.
    otp.value = ''
    formError.value = toErrorMessage(
      error,
      'The verification code is invalid or has expired.',
    )
  } finally {
    verifying.value = false
  }
}

function backToEmail() {
  step.value = 'request'
  otp.value = ''
  formError.value = ''
}
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
          We sent a 6-digit code to
          <span class="font-medium text-ink" v-text="email" />.
          You can also open the link in that email instead.
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
          <span v-text="formError" />
        </p>

        <button class="btn-auth-primary w-full" type="submit" :disabled="sending">
          <BaseSpinner v-if="sending" />
          <span>Send code</span>
        </button>
      </form>

      <!--
        Step 2: the code only. Filling the last cell submits on its own, because a full
        code has nothing left to confirm.
      -->
      <form v-else class="flex flex-col gap-md" @submit.prevent="submitCode">
        <div class="flex flex-col items-center gap-xs">
          <PinInput
            v-model="otp"
            :length="6"
            autofocus
            label="Verification code"
            @complete="submitCode"
          />
        </div>

        <div class="flex items-center justify-end text-caption">
          <!-- Resend waits out the cooldown only, not the whole life of the code: a mail
               that never arrived should not cost the reader the full two minutes. -->
          <button
            class="font-medium text-ink underline-offset-4 transition-opacity duration-150 hover:underline disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline"
            type="button"
            :disabled="!canResend"
            @click="sendCode"
          >
            <span v-text="resendLabel" />
          </button>
        </div>

        <p v-if="formError" class="text-caption text-sticker-orange-deep" role="alert">
          <span v-text="formError" />
        </p>

        <button class="btn-auth-primary w-full" type="submit" :disabled="verifying">
          <BaseSpinner v-if="verifying" />
          <span>Verify code</span>
        </button>

        <button
          class="w-full text-center text-caption text-ink-muted hover:text-ink"
          type="button"
          @click="backToEmail"
        >
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
