<script setup>
/**
 * The empty and error state every list in the app shares.
 *
 * Each page used to hand-roll its own centred paragraph, so "nothing here yet" and
 * "the request failed" looked identical and neither offered a way out. One component
 * keeps the wording, the spacing and the retry affordance the same everywhere.
 *
 * An error state without a retry is a dead end, so `retry` is emitted whenever the
 * parent passes a listener; pages that truly cannot retry simply do not listen.
 */

defineProps({
  // 'empty' is a normal, expected outcome. 'error' means the request failed.
  variant: {
    type: String,
    default: 'empty',
    validator: (value) => ['empty', 'error'].includes(value),
  },
  icon: { type: String, default: '' },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  actionLabel: { type: String, default: '' },
  pending: { type: Boolean, default: false },
})

defineEmits(['action'])
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-xs px-md py-xl text-center"
    :role="variant === 'error' ? 'alert' : 'status'"
  >
    <span v-if="icon" class="text-3xl" aria-hidden="true">{{ icon }}</span>

    <p class="text-heading-3 text-ink">
      {{ title }}
    </p>

    <p v-if="message" class="max-w-prose text-caption text-ink-soft">
      {{ message }}
    </p>

    <slot />

    <button
      v-if="actionLabel"
      class="btn-primary mt-xs"
      type="button"
      :disabled="pending"
      @click="$emit('action')"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>
