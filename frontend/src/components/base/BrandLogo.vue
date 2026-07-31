<script setup>
/**
 * MyQuizz brand logo.
 *
 * The mark is a rounded "speech bubble + Q" built from a squircle, a tail and a
 * quiz spark. It is pure inline SVG so it stays crisp at any size, inherits the
 * demo colours from CSS variables and needs no extra network request.
 *
 * Variants:
 * - "full"  mark + wordmark (header, footer, auth cards)
 * - "mark"  mark only (compact places, favicons, avatars)
 */
const props = defineProps({
  variant: { type: String, default: 'full' },
  // Mark height in pixels. The wordmark scales from it.
  size: { type: Number, default: 22 },
  // Renders the wordmark in white for dark surfaces.
  inverted: { type: Boolean, default: false },
})
</script>

<template>
  <span class="inline-flex items-center" :style="{ gap: `${Math.round(props.size * 0.4)}px` }">
    <svg
      :width="props.size"
      :height="props.size"
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="MyQuizz"
      class="shrink-0"
    >
      <!-- Squircle body in the primary brand blue. -->
      <path
        d="M10.2 1.5h11.6c3.03 0 4.55 0 5.79.62a5.6 5.6 0 0 1 2.44 2.44c.63 1.24.63 2.76.63 5.79v8.3c0 3.03 0 4.55-.63 5.79a5.6 5.6 0 0 1-2.44 2.44c-1.24.62-2.76.62-5.79.62h-3.2l-4.9 3.6a1.2 1.2 0 0 1-1.9-.97V27.5h-1.6c-3.03 0-4.55 0-5.79-.62a5.6 5.6 0 0 1-2.44-2.44C1.5 23.2 1.5 21.68 1.5 18.65v-8.3c0-3.03 0-4.55.62-5.79A5.6 5.6 0 0 1 4.56 2.12C5.8 1.5 7.32 1.5 10.35 1.5Z"
        fill="var(--primary, #0075de)"
      />
      <!-- The Q ring: the quiz mark itself. -->
      <circle cx="16" cy="14" r="5.9" stroke="#ffffff" stroke-width="2.6" />
      <!-- Q tail, angled like a check to hint at the correct answer. -->
      <path
        d="M19.9 18.1 24 22.2"
        stroke="#ffffff"
        stroke-width="2.6"
        stroke-linecap="round"
      />
    </svg>

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
