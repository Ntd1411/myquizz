<script setup>
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'

// The backend finishes Google OAuth by setting HttpOnly cookies and redirecting
// here. There is no token in the URL to read; we simply re-read the session.
const auth = useAuthStore()
const ui = useUiStore()
const route = useRoute()
const router = useRouter()

onMounted(async () => {
  if (route.query.error) {
    ui.toast('Google sign-in failed.', 'error')
    router.replace({ name: 'login' })
    return
  }

  const user = await auth.refresh()
  if (user) {
    ui.toast('Signed in successfully.')
    router.replace({ name: 'home' })
  } else {
    ui.toast('Could not verify your session.', 'error')
    router.replace({ name: 'login' })
  }
})
</script>

<template>
  <div class="container-page flex flex-col items-center gap-sm py-xxl text-ink-muted">
    <BaseSpinner />
    <p class="text-body-sm">
      Finishing sign-in…
    </p>
  </div>
</template>
