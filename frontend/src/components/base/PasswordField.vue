<script setup>
import { ref } from 'vue'

// BaseField with a visibility toggle. The `label-end` slot sits on the label row,
// which is how the login page parks its "Forgot your password?" link there.
defineOptions({ inheritAttrs: false })

defineProps({
  label: { type: String, required: true },
  modelValue: { type: String, default: '' },
  autocomplete: { type: String, default: 'off' },
  required: { type: Boolean, default: false },
})

defineEmits(['update:modelValue'])

const visible = ref(false)

// Exposed so parent pages (e.g. the register wizard) can focus this field's
// input programmatically, such as when a new step comes into view.
const inputRef = ref(null)
defineExpose({ focus: () => inputRef.value?.focus() })
</script>

<template>
  <label class="block">
    <span class="mb-xxs flex items-center">
      <span class="text-caption font-medium text-ink-2">{{ label }}</span>
      <slot name="label-end" />
    </span>
    <span class="relative block">
      <input
        ref="inputRef"
        class="field pr-[44px]"
        :type="visible ? 'text' : 'password'"
        :value="modelValue"
        :autocomplete="autocomplete"
        :required="required"
        v-bind="$attrs"
        @input="$emit('update:modelValue', $event.target.value)"
      >
      <button
        type="button"
        class="absolute inset-y-0 right-0 grid w-[40px] place-items-center text-ink-3 transition-colors duration-ui hover:text-ink"
        :aria-label="visible ? 'Hide password' : 'Show password'"
        :aria-pressed="visible"
        @click="visible = !visible"
      >
        <svg
          v-if="visible"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M17.94 17.94A10.6 10.6 0 0 1 12 19c-6.5 0-10-7-10-7a17.6 17.6 0 0 1 4.06-4.94" />
          <path d="M9.9 4.24A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.7 17.7 0 0 1-2.16 3.19" />
          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
        <svg
          v-else
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </span>
  </label>
</template>
