<script setup>
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import { useAuthStore } from '@/stores/auth.store'

// The backend finishes Google OAuth by setting HttpOnly cookies and redirecting
// here. There is no token in the URL to read; we simply re-read the session.
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

onMounted(async () => {
  // Either leg of a failure lands on the login screen, which is the answer: the
  // visitor is not signed in and the form is right there. Sending them back with a
  // reason attached lets that screen say it in its own words, and its own language.
  if (route.query.error) {
    router.replace({ name: 'login', query: { reason: 'google' } })
    return
  }

  const user = await auth.refresh()
  if (user) {
    router.replace({ name: 'home' })
  } else {
    router.replace({ name: 'login', query: { reason: 'session' } })
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
