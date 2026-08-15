<script setup>
/**
 * The loading placeholder every list shares.
 *
 * A skeleton exists to hold the layout still while data arrives, so its shape has to
 * match what replaces it: pass `rows` for a list, `card` for a grid tile. The pulse is
 * dropped entirely under `prefers-reduced-motion`, where a blinking block is exactly
 * the kind of movement the setting asks us to stop making.
 */

defineProps({
  rows: { type: Number, default: 3 },
  // Tailwind height utility, so a caller can match the real row it stands in for.
  height: { type: String, default: 'h-16' },
  card: { type: Boolean, default: false },
})
</script>

<template>
  <div class="flex flex-col gap-sm" aria-hidden="true">
    <div
      v-for="row in rows"
      :key="row"
      class="skeleton w-full"
      :class="[height, card ? 'rounded-xl' : 'rounded-lg']"
    />
  </div>
</template>

<style scoped>
.skeleton {
  background: linear-gradient(
    90deg,
    rgb(0 0 0 / 4%) 25%,
    rgb(0 0 0 / 8%) 37%,
    rgb(0 0 0 / 4%) 63%
  );
  background-size: 400% 100%;
  animation: skeleton-sweep 1.4s ease infinite;
}

@keyframes skeleton-sweep {
  from {
    background-position: 100% 50%;
  }

  to {
    background-position: 0 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
    background: rgb(0 0 0 / 6%);
  }
}
</style>
