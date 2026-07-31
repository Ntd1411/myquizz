<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import BaseField from '@/components/base/BaseField.vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import { forgotPassword } from '@/api/users.api'
import { useUiStore } from '@/stores/ui.store'
import { toErrorMessage } from '@/api/envelope'

const ui = useUiStore()
const router = useRouter()

const email = ref('')
const pending = ref(false)
const formError = ref('')

async function submit() {
  formError.value = ''
  pending.value = true
  try {
    await forgotPassword(email.value)
    ui.toast('A verification code has been sent to your email.')
    // Carry the email over so the user does not have to retype it.
    router.push({ name: 'reset-password', query: { email: email.value } })
  } catch (error) {
    formError.value = toErrorMessage(error, 'Could not send the verification code.')
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="container-page flex justify-center py-xxl">
    <div class="card-surface w-full max-w-md p-lg">
      <h1 class="text-heading-2 text-ink">Forgot password</h1>
      <p class="mt-xxs text-body-sm text-ink-muted">Enter your email to receive a password reset code.</p>

      <form class="mt-lg flex flex-col gap-sm" @submit.prevent="submit">
        <BaseField v-model="email" label="Email" type="email" autocomplete="email" required />
        <p v-if="formError" class="text-caption text-sticker-orange-deep">{{ formError }}</p>
        <button class="btn-primary mt-xs" type="submit" :disabled="pending">
          <BaseSpinner v-if="pending" />
          <span>Send code</span>
        </button>
      </form>

      <p class="mt-md text-caption">
        <RouterLink :to="{ name: 'login' }" class="text-primary hover:text-primary-active">Back to log in</RouterLink>
      </p>
    </div>
  </div>
</template>
