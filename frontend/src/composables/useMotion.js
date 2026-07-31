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

    // Same feel as the static demo: long glide, slightly damped wheel.
    lenis = new Lenis({ lerp: 0.08, smoothWheel: true, wheelMultiplier: 0.9, anchors: true })
    window.__lenis = lenis
    document.documentElement.classList.add('lenis')

    // Drive Lenis from GSAP's ticker so both share a single RAF loop.
    tickerCallback = (time) => lenis.raf(time * 1000)
    gsap.ticker.add(tickerCallback)
    gsap.ticker.lagSmoothing(0)
    lenis.on('scroll', ScrollTrigger.update)
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
 * Pass a container element; every descendant matching `selector` is revealed.
 */
export function revealOnScroll(container, selector = '[data-reveal]', options = {}) {
  if (!container || prefersReducedMotion()) return null

  const targets = gsap.utils.toArray(selector, container)
  if (!targets.length) return null

  return gsap.from(targets, {
    y: options.y ?? 24,
    opacity: 0,
    duration: options.duration ?? 0.85,
    ease: 'power4.out',
    stagger: options.stagger ?? 0.06,
    scrollTrigger: {
      trigger: container,
      start: options.start ?? 'top 88%',
      once: true,
    },
  })
}
