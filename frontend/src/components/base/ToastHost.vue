<script setup>
import { useUiStore } from '@/stores/ui.store'

const ui = useUiStore()
</script>

<template>
  <div class="pointer-events-none fixed bottom-lg left-1/2 z-[70] flex -translate-x-1/2 flex-col gap-xs">
    <TransitionGroup
      enter-from-class="opacity-0 translate-y-2"
      enter-active-class="transition duration-200 ease-out"
      leave-to-class="opacity-0"
      leave-active-class="transition duration-150 ease-in"
    >
      <div
        v-for="item in ui.toasts"
        :key="item.id"
        class="toast pointer-events-auto font-medium shadow-soft"
        :class="item.variant === 'error' ? 'border-ans-a bg-ans-a-soft text-ans-a' : ''"
        role="status"
      >
        {{ item.message }}
      </div>
    </TransitionGroup>
  </div>
</template>
