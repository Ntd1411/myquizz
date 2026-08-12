<script setup>
import { computed } from 'vue'

/**
 * One of the four answer tiles, design v2.1.
 *
 * While a question is open the tile is a plain white card and only the A-D badge is
 * coloured, so the question is read before the answers. Colour is spent at the moment
 * it means something: grading marks the correct tile with a green border and halo, the
 * player's wrong pick with a red one, and fades the rest. The tile is never filled
 * solid - that was the loud version this revision removed.
 */
const LETTERS = ['A', 'B', 'C', 'D']

const props = defineProps({
  // 0-3. Decides both the letter and which answer colour the tile owns.
  index: { type: Number, required: true },
  text: { type: String, default: '' },
  // 'idle' while answering, then 'correct' | 'wrong' | 'muted' once the round is graded.
  state: { type: String, default: 'idle' },
  selected: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

defineEmits(['select'])

const letter = computed(() => LETTERS[props.index % LETTERS.length])

const slot = computed(() => ['a', 'b', 'c', 'd'][props.index % 4])

// Badge: tinted while the question is open, solid once the tile carries a verdict.
const badgeStyle = computed(() => {
  if (props.state === 'correct') return { backgroundColor: 'var(--ans-d)', color: '#ffffff' }
  if (props.state === 'wrong') return { backgroundColor: 'var(--ans-a)', color: '#ffffff' }
  return {
    backgroundColor: `var(--ans-${slot.value}-soft)`,
    color: `var(--ans-${slot.value})`,
  }
})

const tileStyle = computed(() => {
  if (props.state === 'correct') {
    return { borderColor: 'var(--ans-d)', boxShadow: '0 0 0 3px var(--ans-d-soft)' }
  }
  if (props.state === 'wrong') {
    return { borderColor: 'var(--ans-a)', boxShadow: '0 0 0 3px var(--ans-a-soft)' }
  }
  if (props.state === 'muted') return { opacity: 0.34 }
  if (props.selected) return { borderColor: 'var(--spotlight-line)' }
  return {}
})
</script>

<template>
  <button
    type="button"
    class="tile"
    :style="tileStyle"
    :disabled="disabled"
    :aria-pressed="selected"
    @click="$emit('select', index)"
  >
    <span
      class="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-sm text-caption font-bold"
      :style="badgeStyle"
    >
      {{ letter }}
    </span>
    <span class="min-w-0 flex-1">
      <slot>{{ text }}</slot>
    </span>
  </button>
</template>
