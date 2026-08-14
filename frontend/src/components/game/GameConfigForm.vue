<script setup>
import { computed, ref } from 'vue'
import { FIELD_LABELS, GROUPS, enumLabel, fieldLabel } from '@/constants/gameConfig'

/**
 * Renders the room settings straight from `GET /games/game-modes`.
 *
 * `editable` is a map of dotted path -> `{ kind, min, max, nullable, note, default }`.
 * Nothing is hardcoded here, so a mode that gains or loses a setting on the server needs
 * no change in this component. Paths the mode owns are simply absent from `editable`.
 */
const props = defineProps({
  editable: { type: Object, default: () => ({}) },
  // Flat map keyed by dotted path, e.g. { 'flow.lives': 3 }
  modelValue: { type: Object, required: true },
  disabled: { type: Boolean, default: false },
  // When set, only these dotted paths are rendered, which is how the setup screen keeps
  // the everyday settings apart from the advanced ones without owning two forms.
  paths: { type: Array, default: null },
})

const emit = defineEmits(['update:modelValue'])

// Limits are never advertised up front: a range printed under every box is noise. A message
// only appears once a typed value walks past the range the server would enforce anyway.
const errors = ref({})

const groups = computed(() =>
  GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    fields: Object.entries(props.editable)
      .filter(([path]) => path.startsWith(`${group.key}.`))
      .filter(([path]) => !props.paths || props.paths.includes(path))
      .map(([path, spec]) => ({ path, spec, meta: FIELD_LABELS[path] ?? {} })),
  })).filter((group) => group.fields.length),
)

function fieldId(path) {
  return `cfg-${path.replace(/\./g, '-')}`
}

function set(path, value) {
  emit('update:modelValue', { ...props.modelValue, [path]: value })
}

function clamp(value, spec) {
  let out = Math.round(value)
  if (spec.min !== undefined) out = Math.max(spec.min, out)
  if (spec.max !== undefined) out = Math.min(spec.max, out)
  return out
}

function setError(path, message) {
  const next = { ...errors.value }
  if (message) next[path] = message
  else delete next[path]
  errors.value = next
}

function limitMessage(spec) {
  if (spec.min !== undefined && spec.max !== undefined) {
    return `Enter a number between ${spec.min} and ${spec.max}.`
  }
  if (spec.min !== undefined) return `The lowest value allowed is ${spec.min}.`
  if (spec.max !== undefined) return `The highest value allowed is ${spec.max}.`
  return ''
}

/**
 * An empty box means "no value". The server only accepts that where the field is
 * nullable (per-question time, total match time), so anywhere else the box falls back to
 * the mode default instead of sending something that would come back as ignored.
 *
 * A value outside the range is pulled back to the nearest end and reported, so the form
 * never holds a number the server would refuse.
 */
function onNumber(path, spec, event) {
  const text = String(event.target.value ?? '').trim()
  if (!text) {
    setError(path, '')
    set(path, spec.nullable ? null : (spec.default ?? spec.min ?? 0))
    return
  }
  const parsed = Number(text)
  if (!Number.isFinite(parsed)) {
    setError(path, 'Enter a number.')
    return
  }

  const bounded = clamp(parsed, spec)
  setError(path, bounded === parsed ? '' : limitMessage(spec))
  // The box is rewritten as well: the model already holds the bounded value, so leaving the
  // typed one on screen would show a number that is not the one being saved.
  if (bounded !== parsed) event.target.value = String(bounded)
  set(path, bounded)
}

function numberValue(path) {
  const value = props.modelValue[path]
  return value === null || value === undefined ? '' : value
}

</script>

<template>
  <div class="grid gap-lg">
    <section v-for="group in groups" :key="group.key">
      <p class="eyebrow-label">
        {{ group.label }}
      </p>

      <div class="mt-sm grid gap-sm">
        <div v-for="field in group.fields" :key="field.path">
          <label v-if="field.spec.kind === 'boolean'" class="flex items-start gap-xs">
            <input
              :id="fieldId(field.path)"
              :checked="modelValue[field.path] === true"
              class="mt-[3px] h-[16px] w-[16px] shrink-0 accent-primary"
              type="checkbox"
              :disabled="disabled"
              @change="set(field.path, $event.target.checked)"
            >
            <span>
              <span class="block text-body-sm text-ink">{{ fieldLabel(field.path) }}</span>
              <span v-if="field.meta.help" class="block text-caption text-ink-faint">
                {{ field.meta.help }}
              </span>
            </span>
          </label>

          <label v-else-if="field.spec.kind === 'enum'" class="block">
            <span class="mb-xxs block text-body-sm font-medium text-ink-secondary">
              {{ fieldLabel(field.path) }}
            </span>
            <select
              :id="fieldId(field.path)"
              :value="modelValue[field.path]"
              class="field"
              :disabled="disabled"
              @change="set(field.path, $event.target.value)"
            >
              <option v-for="option in field.spec.values" :key="option" :value="option">
                {{ enumLabel(option) }}
              </option>
            </select>
            <span v-if="field.meta.help" class="mt-xxs block text-caption text-ink-faint">
              {{ field.meta.help }}
            </span>
          </label>

          <label v-else class="block">
            <span class="mb-xxs block text-body-sm font-medium text-ink-secondary">
              {{ fieldLabel(field.path) }}<template v-if="field.meta.unit"> ({{ field.meta.unit }})</template>
            </span>
            <input
              :id="fieldId(field.path)"
              :value="numberValue(field.path)"
              class="field"
              type="number"
              inputmode="numeric"
              :placeholder="field.spec.nullable ? 'Default' : ''"
              :disabled="disabled"
              @change="onNumber(field.path, field.spec, $event)"
            >
            <span v-if="errors[field.path]" class="mt-xxs block text-caption text-sticker-orange-deep">
              {{ errors[field.path] }}
            </span>
            <span v-else-if="field.meta.help || field.spec.note" class="mt-xxs block text-caption text-ink-faint">
              {{ field.meta.help || field.spec.note }}
            </span>
          </label>
        </div>
      </div>
    </section>
  </div>
</template>
