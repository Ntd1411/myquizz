<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  COVER_HEIGHT,
  COVER_WIDTH,
  clampCrop,
  cropToFile,
  loadCroppableImage,
} from '@/utils/imageCrop'

/**
 * Fixed-ratio crop dialog shared by every image an author uploads: the quiz cover,
 * a question illustration and the account avatar. The output size arrives as a prop
 * instead of being a constant, because each surface renders at its own ratio and the
 * file leaving this dialog is exactly the file that gets stored.
 *
 * Two rules keep repeated cropping safe:
 *   - the parent always passes the ORIGINAL image as `src`, never the previous crop,
 *     so quality does not degrade as the author changes their mind
 *   - the parent passes back the `crop` rectangle it was given, so reopening the
 *     dialog restores the frame that was last drawn instead of resetting it
 *
 * The rectangle is measured in natural pixels of the source image, which keeps it
 * independent of how large this dialog happens to be on screen.
 */
const MAX_ZOOM = 4

const props = defineProps({
  src: { type: String, default: '' },
  // Rectangle from a previous crop of the same source, in natural pixels.
  crop: { type: Object, default: null },
  width: { type: Number, default: COVER_WIDTH },
  height: { type: Number, default: COVER_HEIGHT },
  title: { type: String, default: 'Crop image' },
  // Circular mask, for the avatar. It only changes the preview: the stored file is
  // still a square, because that is what an <img> in a round frame needs.
  round: { type: Boolean, default: false },
})

const emit = defineEmits(['apply', 'cancel'])

const frameEl = ref(null)
const displaySrc = ref('')
const loading = ref(true)
const working = ref(false)
const error = ref('')
const natural = ref({ width: 0, height: 0 })
const frame = ref({ width: 0, height: 0 })
const zoom = ref(1)
const offset = ref({ x: 0, y: 0 })

// Not reactive: the decoded bitmap, its cleanup, the observer and the drag state are
// never read by the template.
let source = null
let release = null
let observer = null
let drag = null

const ratio = computed(() => props.width / props.height)

const ready = computed(() => !loading.value && !error.value && frame.value.width > 0)

// The zoom floor is the scale at which the image still covers the whole frame, so no
// crop can ever contain empty space.
const minScale = computed(() => {
  if (!natural.value.width || !frame.value.width) return 1
  return Math.max(
    frame.value.width / natural.value.width,
    frame.value.height / natural.value.height,
  )
})

const scale = computed(() => minScale.value * zoom.value)

const displaySize = computed(() => ({
  width: natural.value.width * scale.value,
  height: natural.value.height * scale.value,
}))

/** Keeps the image covering the frame: the top-left corner can only go negative. */
function clampOffset(next) {
  return {
    x: Math.min(0, Math.max(frame.value.width - displaySize.value.width, next.x)),
    y: Math.min(0, Math.max(frame.value.height - displaySize.value.height, next.y)),
  }
}

function centre() {
  offset.value = clampOffset({
    x: (frame.value.width - displaySize.value.width) / 2,
    y: (frame.value.height - displaySize.value.height) / 2,
  })
}

/** What the frame currently shows, in natural pixels of the source image. */
function currentCrop() {
  const factor = scale.value
  return {
    x: -offset.value.x / factor,
    y: -offset.value.y / factor,
    width: frame.value.width / factor,
    height: frame.value.height / factor,
  }
}

/**
 * Puts the frame back where a previous crop left it. A rectangle tighter than
 * MAX_ZOOM allows can only be approximated, which is why the zoom is clamped rather
 * than trusted.
 */
function restore(saved) {
  if (!saved || !(saved.width > 0) || !(saved.height > 0)) return false
  if (!frame.value.width || !minScale.value) return false

  zoom.value = Math.min(MAX_ZOOM, Math.max(1, frame.value.width / saved.width / minScale.value))

  const factor = scale.value
  offset.value = clampOffset({ x: -saved.x * factor, y: -saved.y * factor })
  return true
}

function measure() {
  const el = frameEl.value
  if (!el) return

  const width = el.clientWidth
  frame.value = { width, height: width / ratio.value }
  offset.value = clampOffset(offset.value)
}

/** Zooming keeps whatever sits in the middle of the frame in the middle of the frame. */
function setZoom(next) {
  const previous = scale.value
  zoom.value = Math.min(MAX_ZOOM, Math.max(1, Number(next) || 1))

  const factor = scale.value / previous
  const centreX = frame.value.width / 2
  const centreY = frame.value.height / 2
  offset.value = clampOffset({
    x: (offset.value.x - centreX) * factor + centreX,
    y: (offset.value.y - centreY) * factor + centreY,
  })
}

function reset() {
  zoom.value = 1
  centre()
}

function onPointerDown(event) {
  if (!ready.value) return
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, from: { ...offset.value } }
  event.currentTarget.setPointerCapture(event.pointerId)
}

function onPointerMove(event) {
  if (!drag || drag.id !== event.pointerId) return
  offset.value = clampOffset({
    x: drag.from.x + (event.clientX - drag.x),
    y: drag.from.y + (event.clientY - drag.y),
  })
}

function onPointerUp(event) {
  if (!drag || drag.id !== event.pointerId) return
  drag = null
}

function onKeydown(event) {
  if (event.key === 'Escape') emit('cancel')
}

async function apply() {
  if (!ready.value || !source) return

  working.value = true
  error.value = ''
  try {
    // Clamped here rather than inside the encoder, so the rectangle handed back to
    // the parent is the one that was actually drawn and can be restored exactly.
    const crop = clampCrop(source, currentCrop())
    const file = await cropToFile(source, crop, { width: props.width, height: props.height })
    emit('apply', { file, crop })
  } catch (failure) {
    // Canvas and DOM exceptions are English and unpredictable; keep them in the console.
    if (failure) console.warn('crop failed', failure)
    error.value = 'The crop could not be created.'
  } finally {
    working.value = false
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)

  try {
    const loaded = await loadCroppableImage(props.src)
    source = loaded.image
    release = loaded.release
    natural.value = { width: source.naturalWidth, height: source.naturalHeight }
    displaySrc.value = source.src
  } catch (failure) {
    if (failure) console.warn('image load failed', failure)
    error.value = 'This image could not be loaded.'
    loading.value = false
    return
  }

  loading.value = false
  await nextTick()

  measure()
  if (!restore(props.crop)) centre()

  // The dialog is responsive, so the frame can change size while it is open.
  observer = new ResizeObserver(() => measure())
  if (frameEl.value) observer.observe(frameEl.value)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  observer?.disconnect()
  release?.()
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/45 p-md"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
    >
      <!--
        A square frame at the width a 16:10 one wants would run off the top and bottom of
        the screen, so an avatar-shaped crop gets a narrower dialog.
      -->
      <div
        class="card-soft w-full rounded-xl p-lg"
        :class="round ? 'max-w-[400px]' : 'max-w-[680px]'"
      >
        <h2 class="text-h5 font-semibold text-ink">
          {{ title }}
        </h2>
        <p class="mt-xxs text-caption text-ink-secondary">
          Drag the image to reposition it, zoom to fill the frame. It is stored at
          {{ width }}×{{ height }}.
        </p>

        <div
          ref="frameEl"
          class="relative mt-md w-full select-none overflow-hidden rounded-md bg-canvas-soft ring-1 ring-hairline"
          :style="{ aspectRatio: `${width} / ${height}` }"
          :class="ready ? 'cursor-grab active:cursor-grabbing touch-none' : ''"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <img
            v-if="displaySrc"
            :src="displaySrc"
            alt=""
            draggable="false"
            class="absolute left-0 top-0 origin-top-left max-w-none"
            :style="{
              width: `${displaySize.width}px`,
              height: `${displaySize.height}px`,
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }"
          >

          <!-- Round preview for the avatar: the corners that will never be seen are
               dimmed instead of being cropped away. -->
          <div
            v-if="round && ready"
            class="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/70"
            style="box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45) inset"
          />

          <p
            v-if="loading"
            class="absolute inset-0 flex items-center justify-center text-caption text-ink-faint"
          >
            Loading the image…
          </p>
        </div>

        <label v-if="ready" class="mt-md block">
          <span class="mb-xxs block text-caption text-ink-secondary">Zoom</span>
          <input
            class="w-full accent-spotlight"
            type="range"
            min="1"
            :max="MAX_ZOOM"
            step="0.01"
            :value="zoom"
            @input="setZoom($event.target.value)"
          >
        </label>

        <p v-if="error" class="mt-sm text-caption text-ans-a">
          {{ error }}
        </p>

        <div class="mt-lg flex flex-wrap items-center justify-end gap-sm">
          <button type="button" class="btn btn-ghost mr-auto" :disabled="!ready" @click="reset">
            Reset
          </button>
          <button type="button" class="btn btn-secondary" @click="emit('cancel')">
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!ready || working"
            @click="apply"
          >
            {{ working ? 'Cropping…' : 'Use this crop' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
