<script setup>
import { computed } from 'vue'

/**
 * Round author / player avatar.
 *
 * Falls back to the first letter on one of the four answer colours, picked
 * deterministically from the name so the same person always keeps the same colour.
 * Names are never printed next to the avatar on a quiz card: the tooltip and the detail
 * page carry the name, the card only needs the face.
 */
const SLOTS = ['a', 'b', 'c', 'd']

const props = defineProps({
  name: { type: String, default: '' },
  src: { type: String, default: '' },
  size: { type: Number, default: 28 },
})

const displayName = computed(() => props.name?.trim() || 'MyQuizz')

const initial = computed(() => displayName.value[0].toUpperCase())

const slot = computed(() => {
  let hash = 0
  for (let i = 0; i < displayName.value.length; i += 1) {
    hash = (hash * 31 + displayName.value.charCodeAt(i)) % 9973
  }
  return SLOTS[hash % SLOTS.length]
})

const boxStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}))

const fallbackStyle = computed(() => ({
  backgroundColor: `var(--ans-${slot.value}-soft)`,
  color: `var(--ans-${slot.value})`,
  fontSize: `${Math.max(10, Math.round(props.size * 0.4))}px`,
}))
</script>

<template>
  <span
    class="grid shrink-0 place-items-center overflow-hidden rounded-full ring-1 ring-hairline"
    :style="boxStyle"
    :title="displayName"
  >
    <img
      v-if="src"
      :src="src"
      :alt="displayName"
      class="h-full w-full object-cover"
      draggable="false"
      loading="lazy"
    >
    <span
      v-else
      class="grid h-full w-full place-items-center font-semibold"
      :style="fallbackStyle"
    >
      {{ initial }}
    </span>
  </span>
</template>
