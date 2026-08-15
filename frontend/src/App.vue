<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TopBar from '@/components/layout/TopBar.vue'
import AppFooter from '@/components/layout/AppFooter.vue'
import ToastHost from '@/components/base/ToastHost.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import {
  AUTH_EXPIRED_EVENT,
  RATE_LIMITED_EVENT,
  FORBIDDEN_EVENT,
  NOT_FOUND_EVENT,
} from '@/api/http'
import { useLenis, ScrollTrigger } from '@/composables/useMotion'

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()
const route = useRoute()

/**
 * Live-room routes (join, host lobby, player lobby) opt out of the site chrome with
 * `meta.bare`. They own a full screen from the top bar down, and every link in the header
 * would take a player out of the room they are sitting in.
 */
const bare = computed(() => route.meta.bare === true)

useLenis()

function onAuthExpired() {
  auth.clear()
  ui.toast('Your session has expired. Please log in again.', 'error')
  router.push({ name: 'login' })
}

function onRateLimited() {
  ui.toast('You are going too fast. Please wait a moment.', 'error')
}

function onForbidden() {
  ui.toast('You do not have permission to do that.', 'error')
}

function onNotFound() {
  ui.toast('That item no longer exists.', 'error')
}

onMounted(() => {
  window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired)
  window.addEventListener(RATE_LIMITED_EVENT, onRateLimited)
  window.addEventListener(FORBIDDEN_EVENT, onForbidden)
  window.addEventListener(NOT_FOUND_EVENT, onNotFound)
})

onBeforeUnmount(() => {
  window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired)
  window.removeEventListener(RATE_LIMITED_EVENT, onRateLimited)
  window.removeEventListener(FORBIDDEN_EVENT, onForbidden)
  window.removeEventListener(NOT_FOUND_EVENT, onNotFound)
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill())
})
</script>

<template>
  <TopBar v-if="!bare" />
  <main :class="bare ? '' : 'min-h-[60vh]'">
    <RouterView />
  </main>
  <AppFooter v-if="!bare" />
  <ToastHost />
</template>
