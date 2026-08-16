<script setup>
import { ref } from 'vue'

// Thin labelled wrapper around a native input so every form looks identical.
// Extra attributes (inputmode, maxlength, minlength, pattern, ...) are forwarded
// to the input instead of the label, so callers can use native validation.
defineOptions({ inheritAttrs: false })

defineProps({
  label: { type: String, required: true },
  modelValue: { type: [String, Number], default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  autocomplete: { type: String, default: 'off' },
  error: { type: String, default: '' },
  required: { type: Boolean, default: false },
})

defineEmits(['update:modelValue'])

// Exposed so parent pages (e.g. the register wizard) can focus this field's
// input programmatically, such as when a new step comes into view.
const inputRef = ref(null)
defineExpose({ focus: () => inputRef.value?.focus() })
</script>

<template>
  <label class="block">
    <span class="mb-xxs block text-caption font-medium text-ink-2">{{ label }}</span>
    <input
      ref="inputRef"
      class="field"
      :class="error ? 'border-ans-a' : ''"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :required="required"
      v-bind="$attrs"
      @input="$emit('update:modelValue', $event.target.value)"
    >
    <!-- Answer A is the error colour. Nothing else in the system is allowed to be red. -->
    <span v-if="error" class="mt-xxs block text-caption text-ans-a">{{ error }}</span>
  </label>
</template>
