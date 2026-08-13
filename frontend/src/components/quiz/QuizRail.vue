<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import QuizCard from './QuizCard.vue'
import { revealGroup } from '@/composables/useMotion'

/**
 * Horizontal rail built on native scrolling.
 *
 * Earlier this was a Flip "caterpillar" that hid the cards outside a fixed window.
 * That looked lively but was awkward to operate: no free swipe, no trackpad scroll,
 * no keyboard, and cards popped in and out. Now the track is a plain scroll
 * container with scroll snapping, so wheel, trackpad, touch swipe, keyboard and the
 * arrow buttons all work, and every card stays in the DOM.
 *
 * The arrow buttons are centred on the outer edge of the card lane: exactly half of
 * each button sits over the first/last card and half outside it.
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

const railEl = ref(null)
const trackEl = ref(null)
const headerEl = ref(null)

const perView = ref(4)
const cardWidth = ref(288)
const atStart = ref(true)
const atEnd = ref(false)

// Quiz cards only. The header link is the single way into the full listing; a
// trailing card duplicated it and ate one card slot on every rail.
const slides = computed(() => props.items.map((quiz) => ({ key: `quiz-${quiz.id}`, quiz })))

const total = computed(() => slides.value.length)
const canGoPrev = computed(() => !atStart.value)
const canGoNext = computed(() => !atEnd.value)

// Cards shown at once, by width. Desktop 4, tablet 3-2, phone 1.
function perViewFor(width) {
  if (width >= 1080) return 4
  if (width >= 720) return 3
  if (width >= 500) return 2
  return 1
}

/** Recomputes how many cards fit and how wide each one must be. */
async function measure() {
  const track = trackEl.value
  if (!track) {
    // The track is unmounted while loading and while the rail is empty. The edge
    // state still has to be refreshed, or the arrows stay on screen over nothing.
    updateEdges()
    return
  }

  // clientWidth includes the track's own horizontal padding, so the cards must be
  // sized against the content box. Sizing against clientWidth made the row a few
  // pixels wider than its container, which left the rail permanently scrollable
  // and kept the next arrow visible even when every card already fitted.
  const style = window.getComputedStyle(track)
  const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
  const width = track.clientWidth - padding

  perView.value = perViewFor(width)
  cardWidth.value = Math.floor((width - GAP * (perView.value - 1)) / perView.value)

  // The card width lands on the items as an inline style, so scrollWidth only
  // reports the real content size once Vue has flushed it. Reading the edges in
  // the same tick measured the previous layout instead: on first mount that was
  // the 288px default, which overflows a four-card rail and left a next arrow
  // that pointed at nothing and could never clear itself, because a rail that
  // cannot scroll never fires the scroll event that would recompute the edges.
  await nextTick()
  updateEdges()
}

/** Keeps the arrow visibility in sync with the real scroll offset. */
function updateEdges() {
  const track = trackEl.value
  if (!track) {
    atStart.value = true
    atEnd.value = true
    return
  }
  // One pixel of slack absorbs fractional scroll offsets on zoomed displays.
  const maxScroll = track.scrollWidth - track.clientWidth

  // Nothing to scroll: report both edges so neither arrow renders.
  if (maxScroll <= 1) {
    atStart.value = true
    atEnd.value = true
    return
  }

  atStart.value = track.scrollLeft <= 1
  atEnd.value = track.scrollLeft >= maxScroll - 1
}

/** Scrolls by one full page of cards, which is what the arrows do. */
function page(forward) {
  const track = trackEl.value
  if (!track) return
  const step = (cardWidth.value + GAP) * perView.value
  track.scrollBy({ left: forward ? step : -step, behavior: 'smooth' })
}

// Entrance animation: the title and the cards lift into place when the rail first
// reaches the viewport. It reverses when the rail leaves again, so scrolling back up
// replays it.
let killReveal = null

function playReveal() {
  const track = trackEl.value
  if (!track || !railEl.value || !total.value) return
  const cards = Array.from(track.querySelectorAll('.rail-item'))
  if (!cards.length) return

  const targets = headerEl.value ? [headerEl.value, ...cards.slice(0, perView.value)] : cards
  killReveal?.()
  killReveal = revealGroup(railEl.value, targets, { y: 26, stagger: 0.08, start: 'top 92%' })
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

// Rails render empty while the pool request is in flight, so the first real data set
// is what actually gets measured and animated.
watch(
  () => props.items,
  async () => {
    await nextTick()
    if (trackEl.value) trackEl.value.scrollLeft = 0
    measure()
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
        />
        {{ title }}
      </h2>
      <RouterLink v-if="seeAllTo" :to="seeAllTo" class="section-link whitespace-nowrap">
        {{ seeAllLabel }}
      </RouterLink>
    </div>

    <div class="container-page">
      <div ref="railEl" class="relative">
        <!-- Arrows straddle the card lane edge: half over the card, half outside it. -->
        <button
          v-if="canGoPrev"
          type="button"
          class="rail-nav rail-nav-prev"
          aria-label="Previous"
          @click="page(false)"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M15 6l-6 6 6 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <button
          v-if="canGoNext"
          type="button"
          class="rail-nav rail-nav-next"
          aria-label="Next"
          @click="page(true)"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <div v-if="loading" class="flex gap-[20px] overflow-hidden">
          <div
            v-for="n in perView"
            :key="`skeleton-${n}`"
            class="h-[300px] animate-pulse rounded-lg bg-hairline/60"
            :style="{ flex: `0 0 ${cardWidth}px`, width: `${cardWidth}px` }"
          />
        </div>

        <p v-else-if="!total" class="py-lg text-body-sm text-ink-faint">
          No quizzes in this section yet.
        </p>

        <!--
          Native scroller: swipe, wheel, trackpad and keyboard all work. tabindex makes
          the arrow keys usable once the rail has focus.
        -->
        <div
          v-else
          ref="trackEl"
          class="rail-track"
          tabindex="0"
          role="group"
          :aria-label="title"
          @scroll.passive="updateEdges"
        >
          <div
            v-for="slide in slides"
            :key="slide.key"
            class="rail-item"
            :style="{ flex: `0 0 ${cardWidth}px`, width: `${cardWidth}px` }"
          >
            <QuizCard :quiz="slide.quiz" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.rail-track {
  display: flex;
  gap: 20px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  scroll-padding-left: 2px;
  /* Room for the card shadow and the focus ring without clipping them. */
  padding: 4px 2px 10px;
  overscroll-behavior-x: contain;
  /* The scrollbar is hidden on purpose: arrows and swiping are the affordances. */
  scrollbar-width: none;
}

.rail-track::-webkit-scrollbar {
  display: none;
}

.rail-track:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 4px;
  border-radius: var(--r-lg);
}

.rail-item {
  scroll-snap-align: start;
}

/*
  Arrow buttons, centred on the card-lane border.

  The track has 2px of side padding, so the card edge sits 2px inside the rail box.
  Offsetting by 2px and then pulling back half the button width puts the button centre
  exactly on that edge, both horizontally and vertically.

  Vertical: the track pads 4px on top and 10px at the bottom, so the visual centre of a
  card is 3px above the centre of the rail box.

  On narrow viewports the arrows are hidden and swiping takes over.
*/
.rail-nav {
  --rail-nav-size: 40px;
  position: absolute;
  top: calc(50% - 3px);
  z-index: 20;
  display: none;
  height: var(--rail-nav-size);
  width: var(--rail-nav-size);
  transform: translate(-50%, -50%);
  place-items: center;
  border-radius: var(--r-full);
  border: 1px solid var(--hairline);
  background-color: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-1);
  transition:
    background-color 150ms ease,
    transform 150ms ease;
}

.rail-nav-prev {
  left: 2px;
}

.rail-nav-next {
  right: 2px;
  transform: translate(50%, -50%);
}

.rail-nav:hover {
  background-color: var(--canvas-soft);
}

.rail-nav-prev:active {
  transform: translate(-50%, -50%) scale(0.94);
}

.rail-nav-next:active {
  transform: translate(50%, -50%) scale(0.94);
}

@media (min-width: 1200px) {
  .rail-nav {
    display: grid;
  }
}
</style>
