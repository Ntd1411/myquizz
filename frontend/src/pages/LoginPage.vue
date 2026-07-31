<script setup>
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import BaseField from '@/components/base/BaseField.vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { startGoogleLogin } from '@/api/auth.api'
import { toErrorMessage } from '@/api/envelope'

const auth = useAuthStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const formError = ref('')

async function submit() {
  formError.value = ''
  try {
    await auth.login({ email: email.value, password: password.value })
    ui.toast('Signed in successfully.')
    router.push(route.query.redirect || { name: 'home' })
  } catch (error) {
    formError.value = toErrorMessage(error, 'Incorrect email or password.')
  }
}
</script>

<template>
  <div class="container-page flex justify-center py-xxl">
    <div class="card-surface w-full max-w-md p-lg">
      <h1 class="text-heading-2 text-ink">Log in</h1>
      <p class="mt-xxs text-body-sm text-ink-muted">Continue with your MyQuizz account.</p>

      <form class="mt-lg flex flex-col gap-sm" @submit.prevent="submit">
        <BaseField v-model="email" label="Email" type="email" autocomplete="email" required />
        <BaseField v-model="password" label="Password" type="password" autocomplete="current-password" required />

        <p v-if="formError" class="text-caption text-sticker-orange-deep">{{ formError }}</p>

        <button class="btn-primary mt-xs" type="submit" :disabled="auth.pending">
          <BaseSpinner v-if="auth.pending" />
          <span>Log in</span>
        </button>
      </form>

      <div class="my-md flex items-center gap-xs text-caption text-ink-faint">
        <span class="h-px flex-1 bg-hairline"></span>
        <span>or</span>
        <span class="h-px flex-1 bg-hairline"></span>
      </div>

      <button class="btn-utility w-full" type="button" @click="startGoogleLogin">
        Continue with Google
      </button>

      <div class="mt-md flex justify-between text-caption">
        <RouterLink :to="{ name: 'forgot-password' }" class="text-primary hover:text-primary-active">
          Forgot password?
        </RouterLink>
        <RouterLink :to="{ name: 'register' }" class="text-primary hover:text-primary-active">
          Create account
        </RouterLink>
      </div>
    </div>
  </div>
</template>
