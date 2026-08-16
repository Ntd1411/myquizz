<script setup>
/**
 * MyQuizz brand logo, rendered from /logo.png in the public folder.
 *
 * The export is 1152x896 with padding baked around the mark, so the raw image reads
 * small and off-centre at the 20-30px sizes we render. The image therefore sits in a
 * box that keeps the source ratio while the image itself is scaled up by MARK_TRIM,
 * pushing the padding outside the box. Raise MARK_TRIM for an even tighter crop.
 *
 * Variants:
 * - "full"  logo + wordmark (header, footer, auth cards)
 * - "mark"  logo only (compact places, favicons, avatars)
 */
import { computed } from 'vue'

// Intrinsic size of /logo.png. Update both numbers when the asset is re-exported.
const SOURCE_WIDTH = 1152
const SOURCE_HEIGHT = 896
// Fraction of every edge cropped away to drop the padding baked into the asset.
const MARK_TRIM = 0.08

const props = defineProps({
  variant: { type: String, default: 'full' },
  // Logo height in pixels. The wordmark scales from it.
  size: { type: Number, default: 30 },
  // Renders the wordmark in white for dark surfaces.
  inverted: { type: Boolean, default: false },
})

// Visible box: full height, width following the source ratio.
const boxWidth = computed(() => Math.round((props.size * SOURCE_WIDTH) / SOURCE_HEIGHT))
// Scaled-up image so the cropped padding lands outside the box.
const imageHeight = computed(() => Math.round(props.size / (1 - MARK_TRIM * 2)))
</script>

<template>
  <span class="inline-flex items-center" :style="{ gap: `${Math.round(props.size * 0.4)}px` }">
    <span
      class="relative shrink-0 overflow-hidden"
      :style="{ width: `${boxWidth}px`, height: `${props.size}px` }"
    >
      <img
        src="/logo.png"
        alt="MyQuizz"
        class="absolute top-1/2 left-1/2 w-auto max-w-none -translate-x-1/2 -translate-y-1/2"
        :style="{ height: `${imageHeight}px` }"
        decoding="async"
      />
    </span>

    <span
      v-if="props.variant === 'full'"
      class="font-bold tracking-[-0.4px]"
      :class="props.inverted ? 'text-white' : 'text-ink'"
      :style="{ fontSize: `${Math.round(props.size * 0.95)}px` }"
    >
      MyQuizz
    </span>
  </span>
</template>
