<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseField from '@/components/base/BaseField.vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import { resetPassword } from '@/api/users.api'
import { useUiStore } from '@/stores/ui.store'
import { toErrorMessage } from '@/api/envelope'

const ui = useUiStore()
const route = useRoute()
const router = useRouter()

const email = ref(route.query.email ?? '')
const otp = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const pending = ref(false)
const formError = ref('')

async function submit() {
  formError.value = ''

  if (newPassword.value !== confirmPassword.value) {
    formError.value = 'Password confirmation does not match.'
    return
  }

  pending.value = true
  try {
    await resetPassword({ email: email.value, otp: otp.value, newPassword: newPassword.value })
    ui.toast('Your password has been reset.')
    router.push({ name: 'login' })
  } catch (error) {
    formError.value = toErrorMessage(error, 'The verification code is invalid or has expired.')
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="container-page flex justify-center py-xxl">
    <div class="card-surface w-full max-w-md p-lg">
      <h1 class="text-heading-2 text-ink">Reset password</h1>

      <form class="mt-lg flex flex-col gap-sm" @submit.prevent="submit">
        <BaseField v-model="email" label="Email" type="email" autocomplete="email" required />
        <BaseField v-model="otp" label="Verification code" autocomplete="one-time-code" required />
        <BaseField v-model="newPassword" label="New password" type="password" autocomplete="new-password" required />
        <BaseField
          v-model="confirmPassword"
          label="Confirm new password"
          type="password"
          autocomplete="new-password"
          required
        />

        <p v-if="formError" class="text-caption text-sticker-orange-deep">{{ formError }}</p>

        <button class="btn-primary mt-xs" type="submit" :disabled="pending">
          <BaseSpinner v-if="pending" />
          <span>Reset password</span>
        </button>
      </form>
    </div>
  </div>
</template>
