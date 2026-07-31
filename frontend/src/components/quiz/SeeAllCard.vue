<script setup>
// The final item of every rail. It rides the same caterpillar animation as a real
// card, but navigates to the full list instead of a single quiz.
defineProps({
  label: { type: String, default: 'See all' },
  sublabel: { type: String, default: '' },
  to: { type: [String, Object], required: true },
})
</script>

<template>
  <RouterLink
    :to="to"
    class="card-surface flex h-full select-none flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-surface to-canvas-soft text-center"
  >
    <span class="flex flex-col items-center gap-sm p-lg">
      <span class="grid h-[52px] w-[52px] place-items-center rounded-full bg-primary text-white shadow-[0_6px_16px_rgba(0,117,222,0.28)]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5 12h14M13 6l6 6-6 6"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <span class="text-[18px] font-bold tracking-[-0.2px] text-ink">{{ label }}</span>
      <span v-if="sublabel" class="text-[13px] text-ink-faint">{{ sublabel }}</span>
    </span>
  </RouterLink>
</template>
