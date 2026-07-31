<script setup>
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import BaseField from '@/components/base/BaseField.vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { toErrorMessage } from '@/api/envelope'
import { uploadImage } from '@/api/storage.api'
import { updateAvatar } from '@/api/users.api'
import { createDefaultAvatarFile } from '@/utils/defaultAvatar'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

const fullname = ref('')
const email = ref('')
const phone = ref('')
const password = ref('')
const confirmPassword = ref('')
const formError = ref('')

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

async function submit() {
  formError.value = ''

  if (password.value !== confirmPassword.value) {
    formError.value = 'Password confirmation does not match.'
    return
  }

  try {
    await auth.register({
      fullname: fullname.value,
      email: email.value,
      phone: phone.value || undefined,
      password: password.value,
    })

    // Register already sets the session cookies, so the avatar call is authenticated.
    if (auth.isLoggedIn) {
      await attachDefaultAvatar(fullname.value || email.value)
    }

    ui.toast('Account created successfully.')
    router.push({ name: auth.isLoggedIn ? 'home' : 'login' })
  } catch (error) {
    formError.value = toErrorMessage(error, 'Could not create the account.')
  }
}
</script>

<template>
  <div class="container-page flex justify-center py-xxl">
    <div class="card-surface w-full max-w-md p-lg">
      <h1 class="text-heading-2 text-ink">
        Create account
      </h1>

      <form class="mt-lg flex flex-col gap-sm" @submit.prevent="submit">
        <BaseField v-model="fullname" label="Full name" autocomplete="name" required />
        <BaseField
          v-model="email"
          label="Email"
          type="email"
          autocomplete="email"
          required
        />
        <BaseField v-model="phone" label="Phone number (optional)" type="tel" autocomplete="tel" />
        <BaseField
          v-model="password"
          label="Password"
          type="password"
          autocomplete="new-password"
          required
        />
        <BaseField
          v-model="confirmPassword"
          label="Confirm password"
          type="password"
          autocomplete="new-password"
          required
        />

        <p v-if="formError" class="text-caption text-sticker-orange-deep">
          {{ formError }}
        </p>

        <button class="btn-primary mt-xs" type="submit" :disabled="auth.pending">
          <BaseSpinner v-if="auth.pending" />
          <span>Sign up</span>
        </button>
      </form>

      <p class="mt-md text-caption text-ink-muted">
        Already have an account?
        <RouterLink :to="{ name: 'login' }" class="text-primary hover:text-primary-active">
          Log in
        </RouterLink>
      </p>
    </div>
  </div>
</template>
