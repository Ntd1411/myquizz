<script setup>
/**
 * Frame for the live-room screens: join, host lobby, player lobby.
 *
 * These routes drop the site header and footer on purpose. While a room is open the only
 * useful moves are the ones the screen itself offers, and one stray click into Discover
 * would take a player out of the room they just joined. There is no bar at all: the card
 * on screen is the whole interface.
 */
defineProps({
  /** Content width. Lobbies are wider than the single card of the join step. */
  width: { type: String, default: 'max-w-[880px]' },
})
</script>

<template>
  <div class="flex min-h-screen flex-col bg-canvas">
    <main class="container-page flex grow flex-col justify-center py-xl">
      <div class="mx-auto w-full" :class="width">
        <slot />
      </div>
    </main>
  </div>
</template>
