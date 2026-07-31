<script setup>
// Thin labelled wrapper around a native input so every form looks identical.
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
</script>

<template>
  <label class="block">
    <span class="mb-xxs block text-caption font-medium text-ink-secondary">{{ label }}</span>
    <input
      class="field"
      :class="error ? 'border-sticker-orange' : ''"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :required="required"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <span v-if="error" class="mt-xxs block text-caption text-sticker-orange-deep">{{ error }}</span>
  </label>
</template>
