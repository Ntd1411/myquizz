import { onMounted, onBeforeUnmount } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Flip } from 'gsap/Flip'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger, Flip)

/**
 * Motion budget, design v2.1.
 *
 * Only three things move: press feedback, the answer tiles dealing in, and the reveal
 * of a result. Everything else is a CSS transition. Scroll reveals now play ONCE - the
 * old reverse-on-scroll-up made the page flicker every time a list refetched, and a
 * card that fades out while the user scrolls past it reads as a bug, not as polish.
 */

/** Honours the OS "reduce motion" setting. Every animation must check this first. */
export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** GSAP approximations of the two CSS curves in the token set. */
export const EASE_UI = 'power3.out'
export const EASE_SPRING = 'back.out(1.4)'

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
    { opacity: 0, y: options.y ?? 12 },
    {
      opacity: 1,
      y: 0,
      duration: options.duration ?? 0.42,
      ease: EASE_UI,
      stagger: options.stagger ?? 0.05,
      // Transform must be cleared or the CSS hover lift has nothing to animate from.
      clearProps: 'transform',
    },
  )
}

/**
 * Fades and lifts elements into view as they cross the viewport, once each.
 *
 * ScrollTrigger.batch gives every target its own trigger, so a long page reveals
 * section by section instead of firing everything at the container's start position.
 */
export function revealOnScroll(container, selector = '[data-reveal]', options = {}) {
  if (!container || prefersReducedMotion()) return null

  const targets = gsap.utils.toArray(selector, container)
  if (!targets.length) return null

  gsap.set(targets, { opacity: 0, y: options.y ?? 12 })

  return ScrollTrigger.batch(targets, {
    start: options.start ?? 'top 92%',
    // Once only: no reverse, no replay, no flicker when the list refetches.
    once: true,
    onEnter: (batch) => animateIn(batch, options),
  })
}

function animateIn(targets, options) {
  gsap.to(targets, {
    opacity: 1,
    y: 0,
    duration: options.duration ?? 0.42,
    ease: EASE_UI,
    stagger: options.stagger ?? 0.06,
    overwrite: true,
    clearProps: 'transform',
  })
}

/**
 * Reveals a group of cards (a rail) the first time it scrolls into view.
 * Returns a kill function so the caller can clean up on unmount or data change.
 */
export function revealGroup(trigger, targets, options = {}) {
  if (!trigger || !targets?.length || prefersReducedMotion()) return () => {}

  const tween = gsap.fromTo(
    targets,
    { opacity: 0, y: options.y ?? 12 },
    {
      opacity: 1,
      y: 0,
      duration: options.duration ?? 0.42,
      ease: EASE_UI,
      stagger: options.stagger ?? 0.06,
      paused: true,
      clearProps: 'transform',
    },
  )

  const trig = ScrollTrigger.create({
    trigger,
    start: options.start ?? 'top 92%',
    once: true,
    onEnter: () => tween.play(),
  })

  return () => {
    trig.kill()
    tween.kill()
    gsap.set(targets, { clearProps: 'transform,opacity' })
  }
}

/**
 * Answer tiles dealing in when a question opens: 380ms, 60ms apart, with a small
 * overshoot. This is the one place in the product allowed to feel playful, because it
 * is also the moment the player has to re-read the screen from scratch.
 */
export function dealIn(targets, options = {}) {
  const list = gsap.utils.toArray(targets)
  if (!list.length) return null

  if (prefersReducedMotion()) {
    gsap.set(list, { opacity: 1, y: 0, scale: 1 })
    return null
  }

  return gsap.fromTo(
    list,
    { opacity: 0, y: 14, scale: 0.985 },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: options.duration ?? 0.38,
      ease: options.ease ?? EASE_SPRING,
      stagger: options.stagger ?? 0.06,
      clearProps: 'transform',
    },
  )
}

/**
 * Result reveal: plays exactly once, when grading arrives. Never replay it on a
 * refetch - the player would think a second round of scores came in.
 */
export function revealResult(target, options = {}) {
  if (!target) return null

  if (prefersReducedMotion()) {
    gsap.set(target, { opacity: 1, y: 0 })
    return null
  }

  return gsap.fromTo(
    target,
    { opacity: 0, y: 10 },
    {
      opacity: 1,
      y: 0,
      duration: options.duration ?? 0.42,
      ease: EASE_UI,
      clearProps: 'transform',
    },
  )
}
