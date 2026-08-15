<script setup>
import { computed } from 'vue'

/**
 * Frame for the live-room screens: join, host lobby, player lobby.
 *
 * These routes drop the site header and footer on purpose. While a room is open the only
 * useful moves are the ones the screen itself offers, and one stray click into Discover
 * would take a player out of the room they just joined.
 *
 * Three widths, because a room is not a document:
 *   default -> a reading column, used by the join step
 *   wide    -> the whole page minus a gutter, used by the lobbies
 *   bleed   -> the whole viewport, used while a match is running
 */
const props = defineProps({
  /** Content width of the reading column. Ignored by `wide` and `bleed`. */
  width: { type: String, default: 'max-w-[880px]' },
  /** Fill the page width instead of centring a column. */
  wide: { type: Boolean, default: false },
  /** Fill the viewport: gameplay owns the screen, nothing is centred vertically. */
  bleed: { type: Boolean, default: false },
})

const mainClass = computed(() => {
  if (props.bleed) return 'px-sm py-sm md:px-lg md:py-md'
  if (props.wide) return 'px-md py-lg md:px-xl'
  return 'container-page justify-center py-xl'
})
</script>

<template>
  <div class="flex min-h-screen flex-col bg-canvas">
    <main class="flex grow flex-col" :class="mainClass">
      <div v-if="bleed || wide" class="flex w-full grow flex-col">
        <slot />
      </div>
      <div v-else class="mx-auto w-full" :class="width">
        <slot />
      </div>
    </main>
  </div>
</template>
