<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import TopBar from '@/components/layout/TopBar.vue'
import AppFooter from '@/components/layout/AppFooter.vue'
import ToastHost from '@/components/base/ToastHost.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { AUTH_EXPIRED_EVENT, RATE_LIMITED_EVENT } from '@/api/http'
import { useLenis, gsap, ScrollTrigger, prefersReducedMotion } from '@/composables/useMotion'

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

// Scroll progress bar.
// A ScrollTrigger scrub was inaccurate here: the trigger height is measured once,
// while this app changes document height after every async list render, and Lenis
// drives scrolling outside the native scroll event. So the ratio is recomputed
// from live document metrics on each frame that actually scrolls.
let progressEl = null
let setProgress = null
let resizeObserver = null

function updateProgress() {
  if (!setProgress) return
  const doc = document.documentElement
  const scrollable = doc.scrollHeight - window.innerHeight
  const ratio = scrollable > 0 ? window.scrollY / scrollable : 0
  setProgress(Math.min(1, Math.max(0, ratio)))
}

onMounted(() => {
  window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired)
  window.addEventListener(RATE_LIMITED_EVENT, onRateLimited)

  progressEl = document.getElementById('scroll-progress')
  if (!progressEl) return

  if (prefersReducedMotion()) {
    // No easing, but the bar must still reflect the real scroll position.
    setProgress = (value) => gsap.set(progressEl, { scaleX: value })
  } else {
    setProgress = gsap.quickTo(progressEl, 'scaleX', { duration: 0.18, ease: 'none' })
  }

  window.addEventListener('scroll', updateProgress, { passive: true })
  window.addEventListener('resize', updateProgress)

  // Lists load asynchronously, so the document height changes after mount.
  // Recompute whenever the body box changes instead of trusting a cached height.
  resizeObserver = new ResizeObserver(updateProgress)
  resizeObserver.observe(document.body)

  updateProgress()
})

onBeforeUnmount(() => {
  window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired)
  window.removeEventListener(RATE_LIMITED_EVENT, onRateLimited)
  window.removeEventListener('scroll', updateProgress)
  window.removeEventListener('resize', updateProgress)
  if (resizeObserver) resizeObserver.disconnect()
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill())
})
</script>

<template>
  <div id="scroll-progress" />
  <TopBar />
  <main class="min-h-[60vh]">
    <RouterView />
  </main>
  <AppFooter />
  <ToastHost />
</template>
