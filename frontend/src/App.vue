<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TopBar from '@/components/layout/TopBar.vue'
import AppFooter from '@/components/layout/AppFooter.vue'
import { useAuthStore } from '@/stores/auth.store'
import { AUTH_EXPIRED_EVENT } from '@/api/http'
import { ScrollTrigger } from '@/composables/useMotion'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

/**
 * Live-room routes (join, host lobby, player lobby) opt out of the site chrome with
 * `meta.bare`. They own a full screen from the top bar down, and every link in the header
 * would take a player out of the room they are sitting in.
 */
const bare = computed(() => route.meta.bare === true)

/**
 * The one failure the app answers globally, because it is the one failure no screen
 * can answer for itself: the session is gone, so whatever page is open is now
 * showing a signed-in view to a signed-out visitor. Everything else - a refusal, a
 * missing row, too many requests - belongs to the screen that asked for it, which
 * knows where to put the message and in which language.
 */
function onAuthExpired() {
  auth.clear()
  router.push({ name: 'login' })
}

onMounted(() => {
  window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired)
})

onBeforeUnmount(() => {
  window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired)
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill())
})
</script>

<template>
  <TopBar v-if="!bare" />
  <main :class="bare ? '' : 'min-h-[60vh]'">
    <RouterView />
  </main>
  <AppFooter v-if="!bare" />
</template>
