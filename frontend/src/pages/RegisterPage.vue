<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AuthShell from '@/components/auth/AuthShell.vue'
import BaseField from '@/components/base/BaseField.vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import PasswordField from '@/components/base/PasswordField.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { toErrorMessage } from '@/api/envelope'
import { startGoogleLogin } from '@/api/auth.api'
import { uploadImage } from '@/api/storage.api'
import { updateAvatar } from '@/api/users.api'
import { createDefaultAvatarFile } from '@/utils/defaultAvatar'
import { useGoogleOneTap } from '@/composables/useGoogleOneTap'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

// Three steps: identity (name + email), password, then an optional phone number.
// The Google button only lives on the first step: past that point the reader has
// already chosen the password path.
const step = ref(1)

// Ref to whichever field should receive focus for the step currently on
// screen (BaseField/PasswordField both expose a focus() method for this).
const firstFieldRef = ref(null)

function focusFirstField() {
  nextTick(() => firstFieldRef.value?.focus())
}

watch(step, focusFirstField)
onMounted(focusFirstField)

const fullname = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const phone = ref('')
const formError = ref('')

const STEP_TITLES = {
  1: 'Create your account',
  2: 'Choose a password',
  3: 'Add your phone number',
}

const STEP_SUBTITLES = {
  1: 'Enter your name and email to get started',
  2: 'At least 8 characters, and type it twice to be sure',
  3: 'Optional - you can always add it later in settings',
}

const stepTitle = computed(() => STEP_TITLES[step.value])
const stepSubtitle = computed(() => STEP_SUBTITLES[step.value])

/**
 * Validates the fields of the step currently on screen. Returns true when the
 * wizard may move forward; the message stays on screen otherwise.
 */
function validateStep() {
  if (step.value === 1) {
    if (fullname.value.trim().length < 2) {
      formError.value = 'Please enter your full name.'
      return false
    }
    if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) {
      formError.value = 'Please enter a valid email address.'
      return false
    }
  }

  if (step.value === 2) {
    if (password.value.length < 8) {
      formError.value = 'Password must be at least 8 characters.'
      return false
    }
    if (password.value !== confirmPassword.value) {
      formError.value = 'Password confirmation does not match.'
      return false
    }
  }

  return true
}

function nextStep() {
  formError.value = ''
  if (!validateStep()) return
  step.value += 1
}

function prevStep() {
  formError.value = ''
  step.value -= 1
}

/**
 * Gives the brand-new account a real avatar image: first letter of the name on a
 * random palette colour, uploaded through /storage/presign and stored with
 * PATCH /users/me/avatar. Failures are swallowed on purpose - the account already
 * exists at this point and a missing decoration must not look like a signup error.
 */
async function attachDefaultAvatar(name) {
  try {
    const file = await createDefaultAvatarFile(name)
    if (!file) return
    const publicUrl = await uploadImage(file, 'avatars')
    const stored = await updateAvatar(publicUrl)
    auth.patchUser({ avatar: stored || publicUrl })
  } catch {
    // Ignored: the UI falls back to the initial-based placeholder.
  }
}

/**
 * Single handler for the form's submit event, fired by every step's default
 * button (Enter or a real click activates it the same way). Steps 1-2 just
 * validate and move on; step 3 actually creates the account.
 */
async function submit() {
  formError.value = ''

  if (step.value < 3) {
    nextStep()
    return
  }

  try {
    await auth.register({
      fullname: fullname.value,
      email: email.value,
      phone: phone.value || undefined,
      password: password.value,
    })

    // register() chains a normal login with the same credentials, so the account
    // is always signed in by the time this resolves.
    await attachDefaultAvatar(fullname.value || email.value)

    ui.toast('Account created successfully.')
    router.push({ name: 'home' })
  } catch (error) {
    formError.value = toErrorMessage(error, 'Could not create the account.')
  }
}

// Google One Tap prompt only - no rendered GIS button. The redirect button below
// (step 1 only) is the one visible Google entry point; One Tap can still complete
// sign-up on its own by verifying a fresh Google profile and creating the account.
useGoogleOneTap({
  prompt: true,
  enabled: !auth.isLoggedIn,
  onSuccess: async (user) => {
    await auth.refresh()
    ui.toast(`Welcome, ${user?.fullname || user?.email || 'friend'}.`)
    router.push({ name: 'home' })
  },
  onError: (error) => {
    formError.value = toErrorMessage(error, 'Google sign-in failed.')
  },
})
</script>

<template>
  <AuthShell>
    <form class="flex flex-col gap-md" @submit.prevent="submit">
      <div class="flex flex-col items-center gap-xxs text-center">
        <h1 class="text-heading-2 text-ink">
          {{ stepTitle }}
        </h1>
        <p class="text-body-sm text-ink-muted sm:whitespace-nowrap">
          {{ stepSubtitle }}
        </p>
        <p class="text-eyebrow uppercase text-ink-3">
          Step {{ step }} of 3
        </p>
      </div>

      <!-- Step 1: identity. Google sign-up lives here only. -->
      <template v-if="step === 1">
        <BaseField ref="firstFieldRef" v-model="fullname" label="Full name" autocomplete="name" required />
        <BaseField
          v-model="email"
          label="Email"
          type="email"
          placeholder="m@example.com"
          autocomplete="email"
          required
        />
      </template>

      <!-- Step 2: password, typed twice. -->
      <template v-else-if="step === 2">
        <PasswordField
          ref="firstFieldRef"
          v-model="password"
          label="Password"
          autocomplete="new-password"
          required
        />
        <PasswordField
          v-model="confirmPassword"
          label="Confirm password"
          autocomplete="new-password"
          required
        />
      </template>

      <!-- Step 3: optional phone number. -->
      <template v-else>
        <BaseField ref="firstFieldRef" v-model="phone" label="Phone number (optional)" type="tel" autocomplete="tel" />
      </template>

      <p v-if="formError" class="text-caption text-sticker-orange-deep" role="alert">
        {{ formError }}
      </p>

      <div class="flex gap-xs">
        <button v-if="step > 1" class="btn-secondary" type="button" @click="prevStep">
          Back
        </button>

        <!--
          Both "Continue" and "Sign up" are type="submit": each step has exactly one
          default submit button, which is what makes pressing Enter in any field on
          any step do the right thing (advance, or create the account on step 3).
        -->
        <button v-if="step < 3" class="btn-auth-primary flex-1" type="submit">
          Continue
        </button>
        <button v-else class="btn-auth-primary flex-1" type="submit" :disabled="auth.pending">
          <BaseSpinner v-if="auth.pending" />
          <span>Sign up</span>
        </button>
      </div>

      <button
        v-if="step === 3"
        class="w-full text-center text-caption text-ink-muted hover:text-ink"
        type="submit"
        :disabled="auth.pending"
        @click="phone = ''"
      >
        Skip for now
      </button>

      <template v-if="step === 1">
        <div class="flex items-center gap-xs text-caption text-ink-faint">
          <span class="h-px flex-1 bg-hairline" />
          <span>Or continue with</span>
          <span class="h-px flex-1 bg-hairline" />
        </div>

        <!-- The Google redirect flow doubles as sign-up: a new Google profile
             creates the account on the backend, so one button serves both pages. -->
        <button class="btn-secondary w-full" type="button" @click="startGoogleLogin">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
            <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
          </svg>
          <span>Sign up with Google</span>
        </button>
      </template>

      <p class="text-center text-caption text-ink-muted">
        Already have an account?
        <RouterLink
          :to="{ name: 'login' }"
          class="font-medium text-ink underline-offset-4 hover:underline"
        >
          Log in
        </RouterLink>
      </p>
    </form>
  </AuthShell>
</template>
