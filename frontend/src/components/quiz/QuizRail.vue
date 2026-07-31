<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import QuizCard from './QuizCard.vue'
import SeeAllCard from './SeeAllCard.vue'
import { gsap, Flip, prefersReducedMotion, revealGroup } from '@/composables/useMotion'

/**
 * Bounded "caterpillar" carousel, ported one-to-one from the home_myquizz.html demo.
 *
 * A fixed window of N cards is visible. Stepping forward hides the leftmost card
 * (it scales down and fades out toward the left edge), slides the middle cards over,
 * and reveals one new card on the right. Stepping back mirrors that.
 *
 * There is NO infinite loop: the window is clamped between 0 and total - perView,
 * and the arrow for an unavailable direction disappears entirely.
 *
 * Implementation note: every item stays mounted at all times. Out-of-window items
 * merely get `display: none` via the `is-hidden` class. GSAP Flip then treats them
 * as entering/leaving targets, which is far more reliable than letting Vue unmount
 * nodes mid-animation.
 */
const props = defineProps({
  title: { type: String, required: true },
  // Decorative sticker swatch rendered next to a topic title. Decoration only.
  swatchColor: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  seeAllTo: { type: [String, Object], default: null },
  seeAllLabel: { type: String, default: 'See all' },
  loading: { type: Boolean, default: false },
})

const GAP = 20
const SWIPE_THRESHOLD = 40

const railEl = ref(null)
const viewportEl = ref(null)
const trackEl = ref(null)
const headerEl = ref(null)

const index = ref(0)
const perView = ref(4)
const cardWidth = ref(288)
const animating = ref(false)
const swiped = ref(false)

// The see-all card is a real slide at the end of the list, so it moves with the
// same animation instead of floating outside the rail.
const slides = computed(() => {
  const list = props.items.map((quiz) => ({ kind: 'quiz', key: `quiz-${quiz.id}`, quiz }))
  if (props.seeAllTo && props.items.length) {
    list.push({ kind: 'see-all', key: 'see-all' })
  }
  return list
})

const total = computed(() => slides.value.length)
const maxIndex = computed(() => Math.max(0, total.value - perView.value))
const canGoPrev = computed(() => index.value > 0)
const canGoNext = computed(() => index.value < maxIndex.value)

function isVisible(position) {
  return position >= index.value && position < index.value + perView.value
}

// Cards shown in the viewport, by width. Desktop 4, tablet 3-2, phone 1.
function perViewFor(width) {
  if (width >= 1080) return 4
  if (width >= 720) return 3
  if (width >= 500) return 2
  return 1
}

/** Recomputes how many cards fit and how wide each one must be. */
function measure() {
  const viewport = viewportEl.value
  if (!viewport) return

  const width = viewport.clientWidth
  perView.value = perViewFor(width)
  cardWidth.value = Math.floor((width - GAP * (perView.value - 1)) / perView.value)

  // Clamp after a resize so a shrinking window never leaves a gap on the right.
  if (index.value > maxIndex.value) index.value = maxIndex.value
}

// Entrance animation: the title and the cards currently in the window lift into
// place the first time this rail reaches the viewport. It runs once per data set,
// and never while a carousel step is mid-flight.
let killReveal = null
let revealed = false

function playReveal() {
  if (revealed || prefersReducedMotion()) return
  const track = trackEl.value
  if (!track || !railEl.value) return

  const cards = gsap.utils.toArray('.rail-item:not(.is-hidden)', track)
  if (!cards.length) return

  revealed = true
  const targets = headerEl.value ? [headerEl.value, ...cards] : cards
  killReveal = revealGroup(railEl.value, targets, { y: 26, stagger: 0.08, start: 'top 92%' })
}

async function step(forward) {
  if (animating.value) return
  if (forward && !canGoNext.value) return
  if (!forward && !canGoPrev.value) return

  const track = trackEl.value
  if (!track) return

  const targets = gsap.utils.toArray('.rail-item', track)

  if (prefersReducedMotion()) {
    index.value += forward ? 1 : -1
    return
  }

  const state = Flip.getState(targets)
  index.value += forward ? 1 : -1
  await nextTick()

  animating.value = true
  Flip.from(state, {
    duration: 0.6,
    ease: 'power2.inOut',
    absoluteOnLeave: true,
    // `fade` is deliberately NOT used: it fights the manual opacity tweens below
    // and leaves a surviving card stuck at opacity 0.
    onEnter: (elements) =>
      gsap.fromTo(
        elements,
        { opacity: 0, scale: 0 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.55,
          ease: 'power3.out',
          transformOrigin: forward ? 'right center' : 'left center',
        },
      ),
    onLeave: (elements) =>
      gsap.to(elements, {
        opacity: 0,
        scale: 0,
        duration: 0.5,
        ease: 'power2.in',
        transformOrigin: forward ? 'left center' : 'right center',
      }),
    onComplete: () => {
      animating.value = false
      // Flip leaves inline transforms behind; clear them or the next step starts
      // from a stale matrix and cards appear to vanish.
      gsap.set(gsap.utils.toArray('.rail-item', track), { clearProps: 'transform,opacity' })
    },
  })
}

// Touch / trackpad swipe with a small dead zone so taps never trigger a step.
let pointerStartX = 0
let pointerStartY = 0
let pointerDown = false
let axisDecided = false
let horizontal = false

function onPointerDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  pointerDown = true
  axisDecided = false
  horizontal = false
  swiped.value = false
  pointerStartX = event.clientX
  pointerStartY = event.clientY
}

function onPointerMove(event) {
  if (!pointerDown || axisDecided) return
  const dx = Math.abs(event.clientX - pointerStartX)
  const dy = Math.abs(event.clientY - pointerStartY)
  if (dx > 8 || dy > 8) {
    axisDecided = true
    horizontal = dx > dy
  }
}

function onPointerUp(event) {
  if (!pointerDown) return
  pointerDown = false
  const delta = event.clientX - pointerStartX
  if (!horizontal || Math.abs(delta) < SWIPE_THRESHOLD) return
  swiped.value = true
  step(delta < 0)
}

// Cancel the click that trails a swipe so a card does not open.
function onClickCapture(event) {
  if (!swiped.value) return
  event.preventDefault()
  event.stopPropagation()
  swiped.value = false
}

let resizeTimer = null
function onResize() {
  window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(measure, 120)
}

onMounted(async () => {
  measure()
  await nextTick()
  playReveal()
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.clearTimeout(resizeTimer)
  window.removeEventListener('resize', onResize)
  killReveal?.()
})

// Reset to the start whenever the underlying data set changes.
watch(
  () => props.items,
  async () => {
    index.value = 0
    await nextTick()
    measure()
    // Rails render empty while the pool request is in flight, so the first real
    // data set is what actually gets the entrance animation.
    killReveal?.()
    revealed = false
    playReveal()
  },
)
</script>

<template>
  <section class="py-lg">
    <div
      ref="headerEl"
      class="container-page mb-[20px] flex items-baseline justify-between gap-sm"
    >
      <h2 class="section-title">
        <span
          v-if="swatchColor"
          class="h-[14px] w-[14px] shrink-0 rounded-xs"
          :style="{ backgroundColor: swatchColor }"
        ></span>
        {{ title }}
      </h2>
      <RouterLink v-if="seeAllTo" :to="seeAllTo" class="section-link whitespace-nowrap">
        {{ seeAllLabel }}
      </RouterLink>
    </div>

    <div class="container-page">
      <div ref="railEl" class="relative">
        <!-- Arrows are removed from the flow entirely when unavailable, so no ghost
             button and no pale halo sits next to the card edge. -->
        <button
          v-if="canGoPrev"
          type="button"
          class="rail-arrow left-[-6px]"
          aria-label="Previous"
          @click="step(false)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <button
          v-if="canGoNext"
          type="button"
          class="rail-arrow right-[-6px]"
          aria-label="Next"
          @click="step(true)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <div
          ref="viewportEl"
          class="cursor-grab touch-pan-y overflow-hidden px-[2px] pb-[6px] pt-[4px] active:cursor-grabbing"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="pointerDown = false"
          @click.capture="onClickCapture"
        >
          <div v-if="loading" class="flex gap-[20px]">
            <div
              v-for="n in perView"
              :key="`skeleton-${n}`"
              class="h-[260px] animate-pulse rounded-lg bg-hairline/60"
              :style="{ flex: `0 0 ${cardWidth}px`, width: `${cardWidth}px` }"
            ></div>
          </div>

          <p v-else-if="!total" class="py-lg text-body-sm text-ink-faint">No quizzes in this section yet.</p>

          <div v-else ref="trackEl" class="flex w-max flex-nowrap items-stretch gap-[20px]">
            <div
              v-for="(slide, position) in slides"
              :key="slide.key"
              class="rail-item"
              :class="{ 'is-hidden': !isVisible(position) }"
              :style="{ flex: `0 0 ${cardWidth}px`, width: `${cardWidth}px` }"
            >
              <SeeAllCard
                v-if="slide.kind === 'see-all'"
                :to="seeAllTo"
                :label="seeAllLabel"
                :sublabel="title"
              />
              <QuizCard v-else :quiz="slide.quiz" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.rail-item.is-hidden {
  display: none;
}
</style>
