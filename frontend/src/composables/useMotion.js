import { onMounted, onBeforeUnmount } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Flip } from 'gsap/Flip'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger, Flip)

/** Honours the OS "reduce motion" setting. Every animation must check this first. */
export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export { gsap, ScrollTrigger, Flip }

/**
 * Boots Lenis smooth scrolling and keeps ScrollTrigger in sync with it.
 * Mount this ONCE, at the app root.
 */
export function useLenis() {
  let lenis = null
  let tickerCallback = null

  onMounted(() => {
    if (prefersReducedMotion()) return

    // Duration + exponential easing is the feel used by the static demo: a long,
    // decelerating glide. A plain lerp settles too early and reads as "sticky".
    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.8,
      // Touch devices keep their native scrolling; only the wheel is smoothed.
      syncTouch: false,
      anchors: true,
    })
    window.__lenis = lenis
    document.documentElement.classList.add('lenis')

    // Drive Lenis from GSAP's ticker so both share a single RAF loop.
    tickerCallback = (time) => lenis.raf(time * 1000)
    gsap.ticker.add(tickerCallback)
    gsap.ticker.lagSmoothing(0)

    // Lenis scrolls the window itself, so triggers only need an update per frame.
    lenis.on('scroll', ScrollTrigger.update)
    ScrollTrigger.refresh()
  })

  onBeforeUnmount(() => {
    if (tickerCallback) gsap.ticker.remove(tickerCallback)
    if (lenis) lenis.destroy()
    document.documentElement.classList.remove('lenis')
    window.__lenis = null
  })
}

/**
 * Fades and lifts elements into view once, when they cross the viewport.
 *
 * Every target gets its own trigger through ScrollTrigger.batch, so a long page
 * reveals section by section instead of firing everything at the container's own
 * start position. Elements that enter together are staggered as one batch.
 */
export function revealOnScroll(container, selector = '[data-reveal]', options = {}) {
  if (!container || prefersReducedMotion()) return null

  const targets = gsap.utils.toArray(selector, container)
  if (!targets.length) return null

  const y = options.y ?? 24
  gsap.set(targets, { opacity: 0, y })

  return ScrollTrigger.batch(targets, {
    start: options.start ?? 'top 90%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        duration: options.duration ?? 0.85,
        ease: 'power4.out',
        stagger: options.stagger ?? 0.07,
        overwrite: true,
        clearProps: 'transform,opacity',
      }),
  })
}

/**
 * Reveals a horizontal group of cards (a rail) when it scrolls into view.
 * Returns a kill function so the caller can clean up on unmount or data change.
 */
export function revealGroup(trigger, targets, options = {}) {
  if (!trigger || !targets?.length || prefersReducedMotion()) return () => {}

  gsap.set(targets, { opacity: 0, y: options.y ?? 26 })

  const tween = gsap.to(targets, {
    opacity: 1,
    y: 0,
    duration: options.duration ?? 0.8,
    ease: 'power4.out',
    stagger: options.stagger ?? 0.08,
    clearProps: 'transform,opacity',
    scrollTrigger: { trigger, start: options.start ?? 'top 90%', once: true },
  })

  return () => {
    tween.scrollTrigger?.kill()
    tween.kill()
    gsap.set(targets, { clearProps: 'transform,opacity' })
  }
}
