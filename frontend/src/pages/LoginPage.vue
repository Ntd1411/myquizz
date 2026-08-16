<script setup>
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AuthShell from '@/components/auth/AuthShell.vue'
import BaseField from '@/components/base/BaseField.vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import PasswordField from '@/components/base/PasswordField.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { startGoogleLogin } from '@/api/auth.api'
import { toErrorMessage } from '@/api/envelope'
import { useGoogleOneTap } from '@/composables/useGoogleOneTap'

const auth = useAuthStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const formError = ref('')

function goAfterLogin() {
  router.push(route.query.redirect || { name: 'home' })
}

async function submit() {
  formError.value = ''
  try {
    await auth.login({ email: email.value, password: password.value })
    ui.toast('Signed in successfully.')
    goAfterLogin()
  } catch (error) {
    formError.value = toErrorMessage(error, 'Incorrect email or password.')
  }
}

// Google One Tap prompt only - no rendered GIS button. The redirect flow below
// stays as the one visible Google entry point; One Tap just pops up on top of it
// when the browser is eligible.
useGoogleOneTap({
  prompt: true,
  enabled: !auth.isLoggedIn,
  onSuccess: async (user) => {
    await auth.refresh()
    ui.toast(`Welcome back, ${user?.fullname || user?.email || 'friend'}.`)
    goAfterLogin()
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
          Log in to your account
        </h1>
        <p class="text-body-sm text-ink-muted sm:whitespace-nowrap">
          Enter your email below to log in to your account
        </p>
      </div>

      <BaseField
        v-model="email"
        label="Email"
        type="email"
        placeholder="m@example.com"
        autocomplete="email"
        required
      />

      <PasswordField
        v-model="password"
        label="Password"
        autocomplete="current-password"
        required
      >
        <template #label-end>
          <RouterLink
            :to="{ name: 'forgot-password' }"
            class="ml-auto text-caption text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Forgot your password?
          </RouterLink>
        </template>
      </PasswordField>

      <p v-if="formError" class="text-caption text-sticker-orange-deep" role="alert">
        {{ formError }}
      </p>

      <button class="btn-auth-primary w-full" type="submit" :disabled="auth.pending">
        <BaseSpinner v-if="auth.pending" />
        <span>Log in</span>
      </button>

      <div class="flex items-center gap-xs text-caption text-ink-faint">
        <span class="h-px flex-1 bg-hairline" />
        <span>Or continue with</span>
        <span class="h-px flex-1 bg-hairline" />
      </div>

      <!-- Redirect flow: the one visible Google entry point. One Tap (above) can
           still complete sign-in on its own without this button being touched. -->
      <button class="btn-secondary w-full" type="button" @click="startGoogleLogin">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
          <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
        </svg>
        <span>Log in with Google</span>
      </button>

      <p class="text-center text-caption text-ink-muted">
        Don't have an account?
        <RouterLink
          :to="{ name: 'register' }"
          class="font-medium text-ink underline-offset-4 hover:underline"
        >
          Sign up
        </RouterLink>
      </p>
    </form>
  </AuthShell>
</template>
