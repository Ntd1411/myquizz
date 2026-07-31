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
 * Shared page-entrance animation. Every routed page calls this with its root element,
 * so opening any page feels identical: elements marked [data-enter] fade and lift once,
 * in source order, right after the route renders.
 *
 * Deliberately not ScrollTrigger-based - an entrance is a one-off, and a trigger here
 * would fight the scroll-linked reveals living further down the same page.
 */
export function revealOnEnter(container, selector = '[data-enter]', options = {}) {
  if (!container) return null

  const targets = gsap.utils.toArray(selector, container)
  if (!targets.length) return null

  if (prefersReducedMotion()) {
    // Clear any inline hidden state so content is never left invisible.
    gsap.set(targets, { opacity: 1, y: 0 })
    return null
  }

  return gsap.fromTo(
    targets,
    { opacity: 0, y: options.y ?? 18 },
    {
      opacity: 1,
      y: 0,
      duration: options.duration ?? 0.55,
      ease: 'power3.out',
      stagger: options.stagger ?? 0.06,
      clearProps: 'transform',
    },
  )
}

/**
 * Fades and lifts elements into view as they cross the viewport.
 *
 * The animation plays on the way down and reverses on the way up, so scrolling back
 * and forth keeps showing it. Every target gets its own trigger through
 * ScrollTrigger.batch, so a long page reveals section by section instead of firing
 * everything at the container's own start position.
 */
export function revealOnScroll(container, selector = '[data-reveal]', options = {}) {
  if (!container || prefersReducedMotion()) return null

  const targets = gsap.utils.toArray(selector, container)
  if (!targets.length) return null

  const y = options.y ?? 24
  gsap.set(targets, { opacity: 0, y })

  return ScrollTrigger.batch(targets, {
    start: options.start ?? 'top 92%',
    // Reverse on scroll-up instead of `once`, which would freeze the end state.
    end: options.end ?? 'bottom 8%',
    onEnter: (batch) => animateIn(batch, options),
    onEnterBack: (batch) => animateIn(batch, options),
    onLeave: (batch) => animateOut(batch, options, y),
    onLeaveBack: (batch) => animateOut(batch, options, y),
  })
}

function animateIn(targets, options) {
  gsap.to(targets, {
    opacity: 1,
    y: 0,
    duration: options.duration ?? 0.7,
    ease: 'power3.out',
    stagger: options.stagger ?? 0.07,
    overwrite: true,
  })
}

function animateOut(targets, options, y) {
  gsap.to(targets, {
    opacity: 0,
    y: y * 0.5,
    duration: options.outDuration ?? 0.3,
    ease: 'power2.in',
    overwrite: true,
  })
}

/**
 * Reveals a group of cards (a rail) when it scrolls into view, and reverses when the
 * group leaves the viewport again so the effect replays in both directions.
 * Returns a kill function so the caller can clean up on unmount or data change.
 */
export function revealGroup(trigger, targets, options = {}) {
  if (!trigger || !targets?.length || prefersReducedMotion()) return () => {}

  const y = options.y ?? 26

  const tween = gsap.fromTo(
    targets,
    { opacity: 0, y },
    {
      opacity: 1,
      y: 0,
      duration: options.duration ?? 0.7,
      ease: 'power3.out',
      stagger: options.stagger ?? 0.08,
      paused: true,
    },
  )

  const trig = ScrollTrigger.create({
    trigger,
    start: options.start ?? 'top 92%',
    end: options.end ?? 'bottom 8%',
    onEnter: () => tween.play(),
    onEnterBack: () => tween.play(),
    onLeave: () => tween.reverse(),
    onLeaveBack: () => tween.reverse(),
  })

  return () => {
    trig.kill()
    tween.kill()
    gsap.set(targets, { clearProps: 'transform,opacity' })
  }
}
