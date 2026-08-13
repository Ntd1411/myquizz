<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import TopBar from '@/components/layout/TopBar.vue'
import AppFooter from '@/components/layout/AppFooter.vue'
import ToastHost from '@/components/base/ToastHost.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { AUTH_EXPIRED_EVENT, RATE_LIMITED_EVENT } from '@/api/http'
import { useLenis, ScrollTrigger } from '@/composables/useMotion'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

useLenis()

function onAuthExpired() {
  auth.clear()
  ui.toast('Your session has expired. Please log in again.', 'error')
  router.push({ name: 'login' })
}

function onRateLimited() {
  ui.toast('You are going too fast. Please wait a moment.', 'error')
}

onMounted(() => {
  window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired)
  window.addEventListener(RATE_LIMITED_EVENT, onRateLimited)
})

onBeforeUnmount(() => {
  window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired)
  window.removeEventListener(RATE_LIMITED_EVENT, onRateLimited)
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill())
})
</script>

<template>
  <TopBar />
  <main class="min-h-[60vh]">
    <RouterView />
  </main>
  <AppFooter />
  <ToastHost />
</template>
