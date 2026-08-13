<script setup>
import { computed, ref, onMounted } from 'vue'

/**
 * Game PIN entry, design v2.1.
 *
 * The component holds ONE string and paints `length` cells from it. That is the whole
 * point of the rebuilt design: a PIN is read as a single block of six digits, not as
 * six separate fields. A transparent proxy input covers the row, so typing, pasting,
 * Backspace, mobile keyboards and autofill all behave natively.
 *
 * Nothing animates here. The active cell lifts 2px and shows a steady caret; a blinking
 * caret or a per-digit pop makes the row feel unsteady exactly while it must feel firm.
 */
const props = defineProps({
  modelValue: { type: String, default: '' },
  length: { type: Number, default: 6 },
  // Host view: renders the room PIN, takes no input and shows no caret.
  readonly: { type: Boolean, default: false },
  autofocus: { type: Boolean, default: false },
  label: { type: String, default: 'Game PIN' },
})

const emit = defineEmits(['update:modelValue', 'complete'])

const inputEl = ref(null)
const focused = ref(false)

const digits = computed(() => {
  const value = props.modelValue.slice(0, props.length)
  return Array.from({ length: props.length }, (_, index) => value[index] ?? '')
})

/** Cell the next digit lands in. Clamped to the last cell once the PIN is full. */
const activeIndex = computed(() => Math.min(props.modelValue.length, props.length - 1))

function isActive(index) {
  return !props.readonly && focused.value && index === activeIndex.value
}

function onInput(event) {
  const next = event.target.value.replace(/\D/g, '').slice(0, props.length)
  // Keep the proxy and the model in step even when the browser accepted more.
  event.target.value = next
  emit('update:modelValue', next)
  if (next.length === props.length) emit('complete', next)
}

function focus() {
  inputEl.value?.focus()
}

onMounted(() => {
  if (props.autofocus && !props.readonly) focus()
})

defineExpose({ focus })
</script>

<template>
  <div class="relative inline-flex">
    <div class="flex gap-[10px]" aria-hidden="true">
      <div
        v-for="(digit, index) in digits"
        :key="index"
        class="pin-cell"
        :class="{ 'is-filled': digit !== '', 'is-active': isActive(index) }"
      >
        <span v-if="digit">{{ digit }}</span>
        <!-- The caret is a steady mark: the lifted cell already says where input goes. -->
        <span v-else-if="isActive(index)" class="h-[26px] w-[2px] rounded-full bg-spotlight" />
      </div>
    </div>

    <!--
      One real field for the whole row. It is invisible but focusable and sized to the
      cells, so a tap anywhere on the PIN opens the keyboard at the right spot.
    -->
    <input
      v-if="!readonly"
      ref="inputEl"
      :value="modelValue"
      class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      type="text"
      inputmode="numeric"
      autocomplete="one-time-code"
      spellcheck="false"
      :maxlength="length"
      :aria-label="label"
      @input="onInput"
      @focus="focused = true"
      @blur="focused = false"
    >
  </div>
</template>
