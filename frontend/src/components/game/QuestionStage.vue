<script setup>
import { computed } from 'vue'

/**
 * One question, drawn the same way on the player screen and on the host console.
 *
 * The component never decides what may be shown: it paints `correctAnswer` only when
 * `reveal` is true, and the caller is the one holding a key it is allowed to have
 * (`host:question` for the host, `question:results` or the answer ack for a player).
 * A screen that passes nothing simply has nothing to leak.
 *
 * Options keep the order the server sent, because `flow.shuffleOptions` is applied server
 * side and grading uses the option id, not the position. The colour of a tile therefore
 * follows the position on screen and carries no meaning: it is there to make four choices
 * scannable in a couple of seconds, not to hint at the answer.
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
  /** Multiple select stages picks instead of sending them, so the tiles get checkboxes. */
  multi: { type: Boolean, default: false },
})

defineEmits(['pick'])

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
// Palette order. A fifth option would start the cycle again rather than invent a hue.
const ACCENTS = ['ans-a', 'ans-b', 'ans-c', 'ans-d']

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
    const accent = ACCENTS[position % ACCENTS.length]
    return {
      key: `${position}:${String(value)}`,
      value,
      text,
      letter: LETTERS[position] ?? String(position + 1),
      style: { '--accent': `var(--${accent})`, '--accent-soft': `var(--${accent}-soft)` },
    }
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

function isPicked(option) {
  return selectedKeys.value.has(asKey(option.value))
}

function stateOf(option) {
  const key = asKey(option.value)
  if (correctKeys.value.size) {
    if (correctKeys.value.has(key)) return 'is-correct'
    return selectedKeys.value.has(key) ? 'is-wrong' : 'is-muted'
  }
  return selectedKeys.value.has(key) ? 'is-selected' : ''
}
</script>

<template>
  <div>
    <h2 class="question-text break-words text-ink">
      {{ question?.question_text }}
    </h2>

    <img
      v-if="question?.question_image"
      class="question-image mt-lg"
      :src="question.question_image"
      alt=""
      loading="lazy"
    >

    <p v-if="question?.question_hint && !reveal" class="hint mt-md">
      <span class="eyebrow-label">Hint</span>
      <span>{{ question.question_hint }}</span>
    </p>

    <div v-if="options.length" class="mt-lg grid gap-sm sm:grid-cols-2">
      <button
        v-for="option in options"
        :key="option.key"
        class="opt"
        :class="stateOf(option)"
        :style="option.style"
        type="button"
        :disabled="disabled"
        :aria-pressed="isPicked(option)"
        @click="$emit('pick', option.value)"
      >
        <span v-if="showBars" class="opt-share-fill" :style="{ width: `${percentOf(option.value)}%` }" />
        <span class="opt-body">
          <span class="opt-letter num">{{ option.letter }}</span>
          <span class="opt-text">{{ option.text }}</span>
          <span v-if="reveal && correctKeys.size" class="opt-mark">
            {{ stateOf(option) === 'is-correct' ? '&#10003;' : stateOf(option) === 'is-wrong' ? '&#10007;' : '' }}
          </span>
          <span v-else-if="multi" class="opt-check" :class="{ 'is-on': isPicked(option) }" />
          <span v-if="showBars" class="opt-share num">{{ percentOf(option.value) }}%</span>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Answer colours come from the palette, so they are written as tokens instead of
   utility classes: the four answer hues are the one place the design system owns. */
.question-text {
  font-size: clamp(22px, 3.4vw, 34px);
  font-weight: 650;
  line-height: 1.25;
  letter-spacing: -0.01em;
  text-wrap: balance;
}

.question-image {
  display: block;
  width: 100%;
  max-height: 320px;
  object-fit: contain;
  border-radius: var(--r-lg);
  background: var(--canvas);
}

.hint {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--r-md);
  background: var(--wash-2);
  color: var(--ink-2);
  font-size: 14px;
}

.opt {
  position: relative;
  overflow: hidden;
  width: 100%;
  min-height: 68px;
  padding: 0;
  text-align: left;
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  background: var(--paper);
  color: var(--ink);
  transition:
    transform var(--t-fast) var(--ease),
    border-color var(--t-ui) var(--ease),
    box-shadow var(--t-ui) var(--ease),
    opacity var(--t-ui) var(--ease);
}

/* The colour rail is what makes a tile findable at a glance. */
.opt::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--accent);
  opacity: 0.9;
}

.opt-body {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 16px 18px 16px 20px;
}

.opt:hover:not(:disabled) {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: 0 10px 24px -18px var(--accent);
}

.opt:active:not(:disabled) {
  transform: translateY(0);
}

.opt:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.opt:disabled {
  cursor: default;
}

.opt.is-selected {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.opt.is-selected .opt-letter {
  background: var(--accent);
  color: #ffffff;
}

.opt.is-correct {
  border-color: var(--ans-d);
  background: var(--ans-d-soft);
}

.opt.is-correct .opt-letter,
.opt.is-correct::before {
  background: var(--ans-d);
  color: #ffffff;
}

.opt.is-wrong {
  border-color: var(--ans-a);
  background: var(--ans-a-soft);
}

.opt.is-wrong .opt-letter,
.opt.is-wrong::before {
  background: var(--ans-a);
  color: #ffffff;
}

/* Everything that was neither picked nor right steps back instead of disappearing. */
.opt.is-muted {
  opacity: 0.55;
}

.opt-letter {
  display: grid;
  place-items: center;
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: var(--r-sm);
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 15px;
  font-weight: 600;
  transition: background var(--t-ui) var(--ease), color var(--t-ui) var(--ease);
}

.opt-text {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 16px;
  line-height: 1.4;
  word-break: break-word;
}

.opt-mark {
  flex: none;
  font-size: 18px;
  line-height: 1;
}

.opt.is-correct .opt-mark {
  color: var(--ans-d);
}

.opt.is-wrong .opt-mark {
  color: var(--ans-a);
}

.opt-check {
  flex: none;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 1.5px solid var(--hairline);
  transition: background var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease);
}

.opt-check.is-on {
  border-color: var(--accent);
  background: var(--accent);
  box-shadow: inset 0 0 0 3px var(--paper);
}

.opt-share {
  flex: none;
  font-size: 13px;
  color: var(--ink-2);
}

/* The share of players who picked this option, drawn behind the label. */
.opt-share-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--accent-soft);
  opacity: 0.7;
  transition: width var(--t-slow) var(--ease);
}

@media (prefers-reduced-motion: reduce) {
  .opt,
  .opt:hover:not(:disabled),
  .opt-share-fill,
  .opt-letter,
  .opt-check {
    transition: none;
    transform: none;
  }
}
</style>
