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

// The box has to point at the list and name the option the arrows are on, so both need an
// id. They only have to be unique within the document.
const listboxId = `combo-list-${Math.random().toString(36).slice(2, 8)}`
const activeIndex = ref(-1)

const matched = computed(
  () => props.options.find((option) => option.value === props.modelValue) || null,
)

const custom = computed(() => typing.value || (props.modelValue !== '' && !matched.value))

// A listed value shows its label ('30 seconds'); a typed one shows itself.
const display = computed(() => (custom.value ? props.modelValue : matched.value?.label || ''))

/*
 * The list as it is walked: every option, and then the Custom row, which is an option of
 * the listbox like any other rather than a button the arrow keys could never reach.
 */
const rows = computed(() => [
  ...props.options.map((option, index) => ({ key: String(index), option })),
  { key: 'custom', option: null },
])

const optionId = (index) => `${listboxId}-${rows.value[index]?.key}`

const isSelected = (row) =>
  row.option ? !custom.value && row.option.value === props.modelValue : custom.value

// What the box reports as the current option, so a screen reader follows the arrow keys
// even though the focus never leaves the box.
const activeDescendant = computed(() =>
  open.value && activeIndex.value !== -1 ? optionId(activeIndex.value) : null,
)

function close() {
  open.value = false
  activeIndex.value = -1
}

function setActive(index) {
  activeIndex.value = index
  if (index === -1) return

  // Nothing inside the list is focused, so the browser will not scroll it for us.
  nextTick(() => document.getElementById(optionId(index))?.scrollIntoView({ block: 'nearest' }))
}

// The list opens on what is already selected, so the first arrow key steps away from the
// current answer rather than from the top of the list.
function openList() {
  open.value = true
  setActive(rows.value.findIndex((row) => isSelected(row)))
}

function moveActive(offset) {
  const count = rows.value.length
  const from = activeIndex.value === -1 ? (offset > 0 ? -1 : 0) : activeIndex.value
  setActive((from + offset + count) % count)
}

function activate(index) {
  const row = rows.value[index]
  if (!row) return

  if (row.option) pick(row.option)
  else pickCustom()
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
  if (open.value) close()
  else openList()
}

function onInput(event) {
  const raw = event.target.value
  emit('update:modelValue', props.type === 'number' && raw !== '' ? Number(raw) : raw)
}

function onKeydown(event) {
  if (event.key === 'Escape' || event.key === 'Tab') {
    if (open.value) close()
    return
  }

  // The keys that open a native select. While typing only the arrows do, so that Enter and
  // the space bar still belong to the text being written.
  const openers = custom.value
    ? ['ArrowDown', 'ArrowUp']
    : ['ArrowDown', 'ArrowUp', 'Enter', ' ']
  if (!open.value) {
    if (!openers.includes(event.key)) return

    event.preventDefault()
    openList()
    return
  }

  /*
   * An open list is walked with the arrows and answered with Enter, the way a select is:
   * before this the options could only be clicked, which left the field unusable to anyone
   * on a keyboard once the list was showing.
   */
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    moveActive(event.key === 'ArrowDown' ? 1 : -1)
    return
  }

  if (event.key === 'Enter' || (event.key === ' ' && !custom.value)) {
    event.preventDefault()
    if (activeIndex.value !== -1) activate(activeIndex.value)
    return
  }

  // Home and End belong to the text while it is being typed.
  if (custom.value) return

  if (event.key === 'Home') {
    event.preventDefault()
    setActive(0)
    return
  }

  if (event.key === 'End') {
    event.preventDefault()
    setActive(rows.value.length - 1)
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
      aria-autocomplete="none"
      :aria-expanded="open"
      :aria-controls="open ? listboxId : null"
      :aria-activedescendant="activeDescendant"
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
      @click="open ? close() : openList()"
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
      :id="listboxId"
      class="absolute inset-x-0 top-[calc(100%+4px)] z-30 max-h-[240px] overflow-auto rounded-md border border-hairline bg-paper py-xxs shadow-[0_12px_32px_rgba(35,36,43,0.14)]"
      role="listbox"
      data-lenis-prevent
    >
      <!--
        The option is the <li> itself. A role="option" on a <button> inside the list is a
        child the listbox cannot own, and a focusable one is a tab stop the combobox pattern
        does not have: the box keeps the focus and names the current option instead.
      -->
      <li
        v-for="(row, index) in rows"
        :id="`${listboxId}-${row.key}`"
        :key="row.key"
        class="cursor-pointer px-sm py-xxs text-body-sm transition-colors duration-150"
        :class="[
          row.option ? '' : 'mt-xxs border-t border-hairline pt-xxs',
          isSelected(row) ? 'text-primary' : 'text-ink',
          activeIndex === index ? 'bg-canvas-soft' : '',
        ]"
        role="option"
        :aria-selected="isSelected(row)"
        @click="activate(index)"
        @mousemove="activeIndex = index"
      >
        {{ row.option ? row.option.label : customLabel }}
      </li>
    </ul>
  </div>
</template>
