import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Flip } from 'gsap/Flip'

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
 * Reveals list items that have just been appended, and only those.
 *
 * An endless list calls this again for every page, so anything already revealed has to
 * be left alone. Re-hiding a card the reader has already scrolled past is exactly what
 * leaves it stuck at opacity 0: its trigger start is behind the scroll position, so the
 * enter callback that would fade it back in never runs. Each node is therefore stamped
 * on its first pass and skipped from then on.
 *
 * Returns a kill function for the triggers this call created.
 */
export function revealAppended(container, selector = '[data-reveal-item]', options = {}) {
  if (!container) return () => {}

  const fresh = gsap.utils.toArray(selector, container).filter((el) => !el.dataset.revealed)
  fresh.forEach((el) => {
    el.dataset.revealed = 'true'
  })

  if (!fresh.length || prefersReducedMotion()) return () => {}

  // A node appended above the trigger line would wait for a scroll that never comes,
  // so it plays straight away; only nodes still below the line get a trigger.
  /*
   * One measurement pass, before any write below. Two filter passes measured every fresh
   * node twice, so a grid of 24 cards asked the browser for 48 layouts in a row - the
   * forced reflow DevTools flags on entry. Splitting in a single loop halves that, and
   * keeping every read ahead of the gsap.set below keeps reads and writes from
   * interleaving, which is what turns each read into a fresh layout.
   */
  const line = window.innerHeight * (options.threshold ?? 0.92)
  const visible = []
  const pending = []
  fresh.forEach((el) => {
    if (el.getBoundingClientRect().top <= line) visible.push(el)
    else pending.push(el)
  })

  gsap.set(fresh, { opacity: 0, y: options.y ?? 16 })

  if (visible.length) animateIn(visible, options)
  if (!pending.length) return () => {}

  const batch = ScrollTrigger.batch(pending, {
    start: options.start ?? 'top 92%',
    once: true,
    onEnter: (group) => animateIn(group, options),
  })

  return () => batch.forEach((trigger) => trigger.kill())
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
