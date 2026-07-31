<script setup>
/**
 * Shared quiz editor used by both the create and the update page. It owns its own
 * working copy of the draft and only emits a validated payload upwards, so the
 * pages stay thin (load / save / redirect).
 */
import { computed, ref, watch } from 'vue'
import { uploadImage } from '@/api/storage.api'
import { toErrorMessage } from '@/api/envelope'
import { useUiStore } from '@/stores/ui.store'
import BrandLogo from '@/components/base/BrandLogo.vue'
import {
  CATEGORIES,
  LANGUAGES,
  LIMITS,
  QUESTION_TYPES,
  TIME_LIMITS,
  buildPayload,
  isChoice,
  makeQuestion,
  makeQuizMeta,
  validateQuiz,
} from '@/utils/quizImport'

const props = defineProps({
  quiz: { type: Object, default: null },
  questions: { type: Array, default: null },
  submitLabel: { type: String, default: 'Publish quiz' },
  busyLabel: { type: String, default: 'Saving…' },
  busy: { type: Boolean, default: false },
  eyebrow: { type: String, default: 'Create' },
  heading: { type: String, default: 'Build a new quiz' },
})

const emit = defineEmits(['submit', 'cancel'])

const ui = useUiStore()

const draft = ref(props.quiz ? { ...makeQuizMeta(), ...props.quiz } : makeQuizMeta())
const items = ref(props.questions?.length ? [...props.questions] : [makeQuestion()])
const coverUploading = ref(false)
const formError = ref('')

// The update page resolves its quiz after mount, so incoming props replace the
// working copy until the user starts editing.
watch(
  () => props.quiz,
  (value) => {
    if (value) draft.value = { ...makeQuizMeta(), ...value }
  },
)
watch(
  () => props.questions,
  (value) => {
    if (value?.length) items.value = [...value]
  },
)

const questionCount = computed(() => items.value.length)

const totalDuration = computed(() => {
  const seconds = items.value.reduce((sum, item) => sum + Number(item.time_limit || 0), 0)
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return minutes ? `${minutes}m ${rest}s` : `${rest}s`
})

function addQuestion() {
  items.value.push(makeQuestion())
}

function duplicateQuestion(index) {
  const source = items.value[index]
  items.value.splice(index + 1, 0, {
    ...source,
    id: makeQuestion().id,
    answer_options: [...source.answer_options],
    correctIndexes: [...source.correctIndexes],
    uploading: false,
  })
}

function removeQuestion(index) {
  if (items.value.length === 1) return
  items.value.splice(index, 1)
}

function moveQuestion(index, offset) {
  const target = index + offset
  if (target < 0 || target >= items.value.length) return
  const list = items.value
  ;[list[index], list[target]] = [list[target], list[index]]
}

/** Switching type resets answer state so leftovers never reach the payload. */
function onTypeChange(question) {
  question.correctIndexes = []
  question.correctText = ''
  while (question.answer_options.length < LIMITS.optionsMax) question.answer_options.push('')
}

function toggleCorrect(question, index) {
  if (question.question_type === 'multiple_choice') {
    question.correctIndexes = [index]
    return
  }
  const position = question.correctIndexes.indexOf(index)
  if (position === -1) question.correctIndexes.push(index)
  else question.correctIndexes.splice(position, 1)
}

const isCorrect = (question, index) => question.correctIndexes.includes(index)

async function onCoverPicked(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  coverUploading.value = true
  try {
    draft.value.quiz_image = await uploadImage(file, 'quizzes')
  } catch (error) {
    ui.toast(toErrorMessage(error, 'Could not upload the cover image.'), 'error')
  } finally {
    coverUploading.value = false
  }
}

async function onQuestionImagePicked(question, event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  question.uploading = true
  try {
    question.question_image = await uploadImage(file, 'questions')
  } catch (error) {
    ui.toast(toErrorMessage(error, 'Could not upload the question image.'), 'error')
  } finally {
    question.uploading = false
  }
}

function submit() {
  formError.value = validateQuiz(draft.value, items.value)
  if (formError.value) {
    ui.toast(formError.value, 'error')
    return
  }
  emit('submit', buildPayload(draft.value, items.value))
}

defineExpose({ setError: (message) => (formError.value = message) })
</script>

<template>
  <div>
    <header class="mb-lg flex flex-wrap items-end justify-between gap-md">
      <div>
        <p class="eyebrow-label">
          {{ eyebrow }}
        </p>
        <h1 class="text-heading-1 text-ink">
          {{ heading }}
        </h1>
        <p class="mt-xxs text-body-sm text-ink-muted">
          {{ questionCount }} question{{ questionCount === 1 ? '' : 's' }} · about
          {{ totalDuration }} of play time
        </p>
      </div>
      <div class="flex items-center gap-sm">
        <button type="button" class="btn btn-ghost" @click="emit('cancel')">
          Cancel
        </button>
        <button type="button" class="btn btn-primary" :disabled="busy" @click="submit">
          {{ busy ? busyLabel : submitLabel }}
        </button>
      </div>
    </header>

    <p v-if="formError" class="mb-md rounded-md bg-red-50 px-md py-sm text-body-sm text-red-600">
      {{ formError }}
    </p>

    <!-- Quiz metadata -->
    <section class="card-surface mb-lg p-lg">
      <div class="mb-md flex items-center gap-sm">
        <BrandLogo variant="mark" :size="22" />
        <h2 class="text-heading-3 text-ink">
          Quiz details
        </h2>
      </div>

      <div class="grid gap-md md:grid-cols-2">
        <label class="block md:col-span-2">
          <span class="mb-xxs block text-caption text-ink-secondary">Quiz name</span>
          <input
            v-model="draft.quiz_name"
            class="field"
            type="text"
            :maxlength="LIMITS.nameMax"
            placeholder="e.g. World capitals in 60 seconds"
          >
        </label>

        <label class="block md:col-span-2">
          <span class="mb-xxs block text-caption text-ink-secondary">Description</span>
          <textarea
            v-model="draft.quiz_description"
            class="field min-h-[96px] resize-y"
            :maxlength="LIMITS.descriptionMax"
            placeholder="Tell players what this quiz is about."
          />
          <span class="mt-xxs block text-right text-caption text-ink-faint">
            {{ draft.quiz_description.length }}/{{ LIMITS.descriptionMax }}
          </span>
        </label>

        <label class="block">
          <span class="mb-xxs block text-caption text-ink-secondary">Category</span>
          <select v-model="draft.quiz_category" class="field">
            <option v-for="category in CATEGORIES" :key="category" :value="category">
              {{ category }}
            </option>
          </select>
        </label>

        <label class="block">
          <span class="mb-xxs block text-caption text-ink-secondary">Language</span>
          <select v-model="draft.quiz_language" class="field">
            <option v-for="language in LANGUAGES" :key="language.value" :value="language.value">
              {{ language.label }}
            </option>
          </select>
        </label>

        <div class="md:col-span-2">
          <span class="mb-xxs block text-caption text-ink-secondary">Cover image</span>
          <div class="flex flex-wrap items-center gap-md">
            <div
              class="flex h-[84px] w-[140px] items-center justify-center overflow-hidden rounded-md bg-canvas-soft ring-1 ring-hairline"
            >
              <img
                v-if="draft.quiz_image"
                :src="draft.quiz_image"
                alt="Quiz cover"
                class="h-full w-full object-cover"
              >
              <span v-else class="text-caption text-ink-faint">No image</span>
            </div>
            <label class="btn btn-utility cursor-pointer">
              {{ coverUploading ? 'Uploading…' : 'Upload image' }}
              <input type="file" accept="image/*" class="hidden" @change="onCoverPicked">
            </label>
            <button
              v-if="draft.quiz_image"
              type="button"
              class="btn btn-ghost"
              @click="draft.quiz_image = ''"
            >
              Remove
            </button>
            <span class="text-caption text-ink-faint">PNG or JPG, up to 2MB.</span>
          </div>
        </div>

        <label class="flex items-center gap-sm md:col-span-2">
          <input v-model="draft.is_public" type="checkbox" class="h-4 w-4 accent-primary">
          <span class="text-body-sm text-ink-secondary">
            Public — anyone can find and play this quiz
          </span>
        </label>
      </div>
    </section>

    <!-- Questions -->
    <section class="space-y-md">
      <article v-for="(question, index) in items" :key="question.id" class="card-surface p-lg">
        <header class="mb-md flex flex-wrap items-center justify-between gap-sm">
          <h3 class="text-title text-ink">
            Question {{ index + 1 }}
          </h3>
          <div class="flex items-center gap-xxs">
            <button
              type="button"
              class="grid h-8 w-8 place-items-center rounded-md border border-hairline bg-surface text-ink transition-colors duration-150 hover:bg-canvas-soft disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Move question up"
              :disabled="index === 0"
              @click="moveQuestion(index, -1)"
            >
              <svg
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                aria-hidden="true"
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
            <button
              type="button"
              class="grid h-8 w-8 place-items-center rounded-md border border-hairline bg-surface text-ink transition-colors duration-150 hover:bg-canvas-soft disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Move question down"
              :disabled="index === items.length - 1"
              @click="moveQuestion(index, 1)"
            >
              <svg
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            </button>
            <button type="button" class="btn btn-ghost" @click="duplicateQuestion(index)">
              Duplicate
            </button>
            <button
              type="button"
              class="btn btn-ghost text-red-600"
              :disabled="items.length === 1"
              @click="removeQuestion(index)"
            >
              Delete
            </button>
          </div>
        </header>

        <div class="grid gap-md md:grid-cols-[2fr_1fr]">
          <label class="block">
            <span class="mb-xxs block text-caption text-ink-secondary">Question</span>
            <input
              v-model="question.question_text"
              class="field"
              type="text"
              :maxlength="LIMITS.questionTextMax"
              placeholder="What do you want to ask?"
            >
          </label>

          <label class="block">
            <span class="mb-xxs block text-caption text-ink-secondary">Type</span>
            <select v-model="question.question_type" class="field" @change="onTypeChange(question)">
              <option v-for="type in QUESTION_TYPES" :key="type.value" :value="type.value">
                {{ type.label }}
              </option>
            </select>
          </label>

          <label class="block">
            <span class="mb-xxs block text-caption text-ink-secondary">Time limit</span>
            <select v-model.number="question.time_limit" class="field">
              <option v-for="seconds in TIME_LIMITS" :key="seconds" :value="seconds">
                {{ seconds }} seconds
              </option>
            </select>
          </label>

          <div class="flex items-end gap-sm">
            <label class="btn btn-utility cursor-pointer">
              {{ question.uploading ? 'Uploading…' : question.question_image ? 'Replace image' : 'Add image' }}
              <input
                type="file"
                accept="image/*"
                class="hidden"
                @change="onQuestionImagePicked(question, $event)"
              >
            </label>
            <button
              v-if="question.question_image"
              type="button"
              class="btn btn-ghost"
              @click="question.question_image = ''"
            >
              Remove
            </button>
          </div>
        </div>

        <img
          v-if="question.question_image"
          :src="question.question_image"
          alt="Question illustration"
          class="mt-md h-[160px] w-full rounded-md object-cover ring-1 ring-hairline"
        >

        <!-- Choice answers -->
        <div v-if="isChoice(question.question_type)" class="mt-md">
          <p class="mb-xxs text-caption text-ink-secondary">
            {{
              question.question_type === 'multiple_choice'
                ? 'Answer options — tick the single correct one'
                : 'Answer options — tick every correct one'
            }}
          </p>
          <div class="grid gap-sm md:grid-cols-2">
            <div
              v-for="(option, optionIndex) in question.answer_options"
              :key="optionIndex"
              class="flex items-center gap-sm"
            >
              <button
                type="button"
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-caption font-semibold ring-1 transition-colors"
                :class="
                  isCorrect(question, optionIndex)
                    ? 'bg-primary text-white ring-primary'
                    : 'bg-surface text-ink-faint ring-hairline'
                "
                :aria-pressed="isCorrect(question, optionIndex)"
                :aria-label="`Mark option ${optionIndex + 1} as correct`"
                @click="toggleCorrect(question, optionIndex)"
              >
                {{ String.fromCharCode(65 + optionIndex) }}
              </button>
              <input
                v-model="question.answer_options[optionIndex]"
                class="field"
                type="text"
                :maxlength="LIMITS.optionMax"
                :placeholder="`Option ${optionIndex + 1}${optionIndex < LIMITS.optionsMin ? '' : ' (optional)'}`"
              >
            </div>
          </div>
        </div>

        <!-- Free text answers -->
        <label v-else class="mt-md block">
          <span class="mb-xxs block text-caption text-ink-secondary">Expected answer</span>
          <textarea
            v-if="question.question_type === 'long_answer'"
            v-model="question.correctText"
            class="field min-h-[88px] resize-y"
            placeholder="The answer players should write."
          />
          <input
            v-else
            v-model="question.correctText"
            class="field"
            type="text"
            placeholder="The answer players should write."
          >
        </label>
      </article>
    </section>

    <div class="mt-lg flex flex-wrap items-center justify-between gap-md">
      <button type="button" class="btn btn-utility" @click="addQuestion">
        + Add question
      </button>
      <button type="button" class="btn btn-primary" :disabled="busy" @click="submit">
        {{ busy ? busyLabel : submitLabel }}
      </button>
    </div>
  </div>
</template>
