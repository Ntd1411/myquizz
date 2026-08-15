<script setup>
import { computed } from 'vue'

/**
 * One question, drawn the same way on the player screen and on the host console.
 *
 * The component never decides what may be shown: it paints `correctAnswer` only when
 * `reveal` is true, and the caller is the one holding a key it is allowed to have
 * (`host:question` for the host, `question:results` for the room). A player screen that
 * passes nothing simply has nothing to leak.
 *
 * Options keep the order the server sent, because `flow.shuffleOptions` is applied server
 * side and grading uses the option id, not the position.
 */
const props = defineProps({
  question: { type: Object, default: null },
  /** Raw values the player picked, in the shape they will be sent back. */
  selected: { type: Array, default: () => [] },
  correctAnswer: { type: [Array, String, Number], default: null },
  /** `question:results` stats: { total, correct, distribution } */
  stats: { type: Object, default: null },
  disabled: { type: Boolean, default: false },
  reveal: { type: Boolean, default: false },
})

defineEmits(['pick'])

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

/** The server compares answers as trimmed lowercase strings, so the UI matches that. */
function asKey(value) {
  return String(value ?? '').trim().toLowerCase()
}

// Snapshots store options either as [{ id, option_text }] or as plain strings.
const options = computed(() =>
  (props.question?.answer_options ?? []).map((option, position) => {
    const isRow = option !== null && typeof option === 'object'
    const value = isRow ? option.id ?? position : option
    const text = isRow ? option.option_text ?? '' : String(option)
    return { key: `${position}:${String(value)}`, value, text }
  }),
)

const selectedKeys = computed(() => new Set(props.selected.map(asKey)))

const correctKeys = computed(() => {
  if (!props.reveal || props.correctAnswer === null || props.correctAnswer === undefined)
    return new Set()
  const list = Array.isArray(props.correctAnswer) ? props.correctAnswer : [props.correctAnswer]
  return new Set(list.map(asKey))
})

const answeredTotal = computed(() => props.stats?.total ?? 0)
// The distribution is keyed by the raw answer, so it only reads back for single answers.
const showBars = computed(() => props.reveal && Boolean(props.stats?.distribution))

function countOf(value) {
  return props.stats?.distribution?.[String(value)] ?? 0
}

function percentOf(value) {
  if (!answeredTotal.value) return 0
  return Math.round((countOf(value) / answeredTotal.value) * 100)
}

function stateOf(option) {
  const key = asKey(option.value)
  if (correctKeys.value.size) {
    if (correctKeys.value.has(key)) return 'is-correct'
    return selectedKeys.value.has(key) ? 'is-wrong' : ''
  }
  return selectedKeys.value.has(key) ? 'is-selected' : ''
}
</script>

<template>
  <div>
    <p class="eyebrow-label">
      Question <span class="num">{{ (question?.index ?? 0) + 1 }}</span> of
      <span class="num">{{ question?.total ?? 0 }}</span>
    </p>
    <h2 class="mt-xs break-words text-heading-2 text-ink">
      {{ question?.question_text }}
    </h2>

    <img
      v-if="question?.question_image"
      :src="question.question_image"
      class="mt-lg max-h-[300px] w-full rounded-[16px] object-contain"
      alt=""
      loading="lazy"
    >

    <p v-if="question?.question_hint" class="mt-sm text-body-sm text-ink-2">
      Hint: {{ question.question_hint }}
    </p>

    <div v-if="options.length" class="mt-lg grid gap-xs sm:grid-cols-2">
      <button
        v-for="(option, position) in options"
        :key="option.key"
        class="opt"
        :class="stateOf(option)"
        type="button"
        :disabled="disabled"
        @click="$emit('pick', option.value)"
      >
        <span class="opt-letter num">{{ LETTERS[position] ?? position + 1 }}</span>
        <span class="opt-text">{{ option.text }}</span>
        <span v-if="showBars" class="opt-share num">{{ percentOf(option.value) }}%</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Answer colours come from the palette, so they are written as tokens instead of
   utility classes: the four answer hues are the one place the design system owns. */
.opt {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  text-align: left;
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  background: var(--paper);
  color: var(--ink);
  transition: transform var(--t-fast) var(--ease), border-color var(--t-ui) var(--ease),
    background var(--t-ui) var(--ease);
}

.opt:hover:not(:disabled) {
  border-color: var(--spotlight-line);
  transform: translateY(-1px);
}

.opt:disabled {
  cursor: default;
}

.opt.is-selected {
  border-color: var(--spotlight);
  background: var(--spotlight-soft);
}

.opt.is-correct {
  border-color: var(--ans-d);
  background: var(--ans-d-soft);
}

.opt.is-wrong {
  border-color: var(--ans-a);
  background: var(--ans-a-soft);
}

.opt-letter {
  display: grid;
  place-items: center;
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: var(--r-sm);
  background: var(--canvas);
  font-size: 13px;
  color: var(--ink-2);
}

.opt-text {
  flex: 1 1 auto;
  min-width: 0;
  word-break: break-word;
}

.opt-share {
  flex: none;
  font-size: 13px;
  color: var(--ink-2);
}

@media (prefers-reduced-motion: reduce) {
  .opt,
  .opt:hover:not(:disabled) {
    transition: none;
    transform: none;
  }
}
</style>
