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
        class="pointer-events-auto rounded-md px-md py-sm text-body-sm font-medium text-white shadow-elevated"
        :class="item.variant === 'error' ? 'bg-sticker-orange-deep' : 'bg-ink-secondary'"
        role="status"
      >
        {{ item.message }}
      </div>
    </TransitionGroup>
  </div>
</template>
