<script setup>
/**
 * A dropdown whose box can turn into an input. The list carries the answers nearly every
 * quiz uses, so by default the field behaves exactly like a select: the box is not typeable
 * and a click anywhere on it opens the list. Choosing "Custom" empties that same box and
 * hands the caret over, while the chevron stays live, so a listed value is one click away
 * again.
 *
 * The mode is derived from the value rather than stored, so a quiz loaded with a value the
 * list does not carry opens ready to edit. The one thing a value cannot say is that the
 * author asked to type while the box is still empty, and that is all `typing` holds.
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  // [{ value, label }], in the order they should be offered.
  options: { type: Array, required: true },
  type: { type: String, default: 'text' },
  invalid: { type: Boolean, default: false },
  maxlength: { type: [String, Number], default: null },
  min: { type: [String, Number], default: null },
  max: { type: [String, Number], default: null },
  customLabel: { type: String, default: 'Custom…' },
  customPlaceholder: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'blur'])

const open = ref(false)
const typing = ref(false)
const rootEl = ref(null)
const inputEl = ref(null)

const matched = computed(
  () => props.options.find((option) => option.value === props.modelValue) || null,
)

const custom = computed(() => typing.value || (props.modelValue !== '' && !matched.value))

// A listed value shows its label ('30 seconds'); a typed one shows itself.
const display = computed(() => (custom.value ? props.modelValue : matched.value?.label || ''))

function close() {
  open.value = false
}

function pick(option) {
  typing.value = false
  emit('update:modelValue', option.value)
  close()
}

async function pickCustom() {
  typing.value = true
  emit('update:modelValue', '')
  close()

  // An empty box the author just asked for is worth little without the caret in it.
  await nextTick()
  inputEl.value?.focus()
}

function onBoxMousedown(event) {
  if (custom.value) return

  // Readonly still takes a caret, and on a phone still raises the keyboard.
  event.preventDefault()
  inputEl.value?.focus()
  open.value = !open.value
}

function onInput(event) {
  const raw = event.target.value
  emit('update:modelValue', props.type === 'number' && raw !== '' ? Number(raw) : raw)
}

function onKeydown(event) {
  if (event.key === 'Escape' && open.value) {
    close()
    return
  }

  // The keys that open a native select. While typing only the arrow does, so that Enter and
  // the space bar still belong to the text being written.
  const openers = custom.value ? ['ArrowDown'] : ['ArrowDown', 'Enter', ' ']
  if (!open.value && openers.includes(event.key)) {
    event.preventDefault()
    open.value = true
  }
}

/*
 * Clicking away gives the list up, the same as a native dropdown. The listener lives only
 * while the list is open; the watcher attaches it on a microtask, after the click that
 * opened the list has finished bubbling, so it cannot close it again on the way out.
 */
function onPointerDown(event) {
  if (!rootEl.value?.contains(event.target)) close()
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('pointerdown', onPointerDown)
    return
  }

  document.removeEventListener('pointerdown', onPointerDown)
})

/*
 * Typing mode belongs to the author, so only something other than the author ends it: a
 * page handing down a value the list carries, such as the editor loading a saved quiz.
 */
watch(
  () => props.modelValue,
  (value) => {
    if (!typing.value || document.activeElement === inputEl.value) return
    if (props.options.some((option) => option.value === value)) typing.value = false
  },
)

onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
</script>

<template>
  <div ref="rootEl" class="relative">
    <input
      ref="inputEl"
      class="field pr-[42px]"
      :class="[invalid ? 'border-ans-a' : '', custom ? '' : 'cursor-pointer']"
      :type="custom ? type : 'text'"
      :value="display"
      :readonly="!custom"
      :placeholder="custom ? customPlaceholder : ''"
      :maxlength="custom ? maxlength : null"
      :min="type === 'number' ? min : null"
      :max="type === 'number' ? max : null"
      :step="type === 'number' ? 1 : null"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @mousedown="onBoxMousedown"
      @input="onInput"
      @keydown="onKeydown"
      @blur="emit('blur', $event)"
    >

    <!--
      Tabbing goes straight past the arrow to the next field, as it would on a select, where
      the arrow is scenery rather than a stop of its own.
    -->
    <button
      type="button"
      class="absolute right-0 top-0 grid h-full w-[42px] place-items-center text-ink-secondary"
      tabindex="-1"
      aria-label="Show the list"
      @click="open = !open"
    >
      <svg
        class="h-[14px] w-[14px]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <ul
      v-if="open"
      class="absolute inset-x-0 top-[calc(100%+4px)] z-30 max-h-[240px] overflow-auto rounded-md border border-hairline bg-paper py-xxs shadow-[0_12px_32px_rgba(35,36,43,0.14)]"
      role="listbox"
      data-lenis-prevent
    >
      <li v-for="option in options" :key="option.value">
        <button
          type="button"
          class="block w-full px-sm py-xxs text-left text-body-sm transition-colors duration-150 hover:bg-canvas-soft"
          :class="!custom && option.value === modelValue ? 'text-primary' : 'text-ink'"
          role="option"
          :aria-selected="!custom && option.value === modelValue"
          @click="pick(option)"
        >
          {{ option.label }}
        </button>
      </li>

      <li class="mt-xxs border-t border-hairline pt-xxs">
        <button
          type="button"
          class="block w-full px-sm py-xxs text-left text-body-sm transition-colors duration-150 hover:bg-canvas-soft"
          :class="custom ? 'text-primary' : 'text-ink'"
          @click="pickCustom"
        >
          {{ customLabel }}
        </button>
      </li>
    </ul>
  </div>
</template>
