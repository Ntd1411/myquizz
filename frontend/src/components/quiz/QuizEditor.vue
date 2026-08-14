<script setup>
/**
 * Shared quiz editor used by both the create and the update page. It owns its own
 * working copy of the draft and only emits a validated payload upwards, so the
 * pages stay thin (load / save / redirect).
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { IMAGE_ACCEPT, checkImageFile, uploadImage } from '@/api/storage.api'
import { toErrorMessage } from '@/api/envelope'
import { saveAutoDraft } from '@/composables/useQuizDraft'
import { createDefaultCoverDataUrl, createDefaultCoverFile } from '@/utils/defaultCover'
import { useUiStore } from '@/stores/ui.store'
import BrandLogo from '@/components/base/BrandLogo.vue'
import {
  CATEGORIES,
  LANGUAGES,
  LIMITS,
  QUESTION_TYPES,
  TIME_LIMITS,
  buildPayload,
  errorMessages,
  isChoice,
  makeQuestion,
  makeQuizMeta,
  validateQuizFields,
} from '@/utils/quizImport'

const props = defineProps({
  quiz: { type: Object, default: null },
  questions: { type: Array, default: null },
  submitLabel: { type: String, default: 'Publish quiz' },
  busyLabel: { type: String, default: 'Saving…' },
  busy: { type: Boolean, default: false },
  // Autosave is off until a page names a slot ('create' or 'edit:<id>').
  autosaveKey: { type: String, default: '' },
})

const emit = defineEmits(['submit', 'cancel', 'dirty'])

const ui = useUiStore()

const draft = ref(props.quiz ? { ...makeQuizMeta(), ...props.quiz } : makeQuizMeta())
const items = ref(props.questions?.length ? [...props.questions] : [makeQuestion()])
const formError = ref('')
const savedLabel = ref('')

/*
 * Errors are computed continuously but only revealed once the author has tried
 * to save: marking every empty field red on an untouched form is noise, and
 * hiding the reason for a blocked save is worse.
 */
const showErrors = ref(false)
const fieldErrors = computed(() => validateQuizFields(draft.value, items.value))
const allIssues = computed(() => errorMessages(fieldErrors.value))
const quizErrors = computed(() => (showErrors.value ? fieldErrors.value.quiz : {}))
const questionErrors = computed(() =>
  items.value.map(
    (item, index) => (showErrors.value ? fieldErrors.value.questions[index] : null) ?? { options: [] },
  ),
)
const ISSUE_PREVIEW = 5
const issues = computed(() => (showErrors.value ? allIssues.value.slice(0, ISSUE_PREVIEW) : []))
const hiddenIssueCount = computed(() =>
  showErrors.value ? Math.max(allIssues.value.length - ISSUE_PREVIEW, 0) : 0,
)

/*
 * Applying the props of the update page must not count as an edit, otherwise the
 * page would warn about unsaved changes for a quiz nobody touched yet.
 */
let applyingProps = false

function applyFromProps(apply) {
  applyingProps = true
  apply()
  nextTick(() => {
    applyingProps = false
  })
}

// The update page resolves its quiz after mount, so incoming props replace the
// working copy until the user starts editing.
watch(
  () => props.quiz,
  (value) => {
    if (value) applyFromProps(() => (draft.value = { ...makeQuizMeta(), ...value }))
  },
)
watch(
  () => props.questions,
  (value) => {
    if (value?.length) applyFromProps(() => (items.value = [...value]))
  },
)

/*
 * Autosave: a debounce keeps a burst of keystrokes down to one write, and the
 * draft is stored under the page's own key so a new quiz and an edited quiz
 * never overwrite each other.
 */
const AUTOSAVE_DELAY = 800
let autosaveTimer = null

watch(
  [draft, items],
  () => {
    if (applyingProps) return
    emit('dirty', true)
    if (!props.autosaveKey) return

    clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => {
      saveAutoDraft(props.autosaveKey, { quiz: draft.value, questions: items.value })
      savedLabel.value = `Draft saved locally at ${new Date().toLocaleTimeString()}`
    }, AUTOSAVE_DELAY)
  },
  { deep: true },
)

function addQuestion() {
  items.value.push(makeQuestion())
}

function addOption(question) {
  if (question.answer_options.length >= LIMITS.optionsMax) return
  question.answer_options.push('')
}

/**
 * Removing a slot has to move the correct answers with it: they are positions in
 * this very list, so everything after the removed slot shifts down by one.
 */
function removeOption(question, index) {
  if (question.answer_options.length <= LIMITS.optionsMin) return
  question.answer_options.splice(index, 1)
  question.correctIndexes = question.correctIndexes
    .filter((position) => position !== index)
    .map((position) => (position > index ? position - 1 : position))
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

  // A free-text question has no options at all, so its slots are left untouched:
  // padding them would only build answers the payload throws away, and keeping
  // them means switching back restores what the author already typed.
  if (!isChoice(question.question_type)) return

  while (question.answer_options.length < LIMITS.optionsMin) question.answer_options.push('')
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

/*
 * Uploads are cancellable and report their own error next to the picker instead
 * of only as a toast, which disappears before the author can act on it.
 */
const coverUploading = ref(false)
const coverError = ref('')
// A quiz saved without a cover gets a generated one, uploaded during the save.
// The submit button says so rather than looking stuck for a second.
const preparingCover = ref(false)
let coverAbort = null
const questionAborts = new Map()

const submitText = computed(() => {
  if (props.busy) return props.busyLabel
  return preparingCover.value ? 'Preparing cover…' : props.submitLabel
})

/*
 * Preview of the generated cover, drawn by the same module that produces the file
 * uploaded on save: what the author sees here is what the quiz will carry, so the
 * promise in the help text below is verifiable instead of a claim.
 * Encoding a PNG on every keystroke would be wasteful, so the redraw is debounced
 * like the autosave.
 */
const COVER_PREVIEW_DELAY = 400
const defaultCoverPreview = ref('')
let coverPreviewTimer = null

watch(
  [() => draft.value.quiz_image, () => draft.value.quiz_name, () => draft.value.quiz_category],
  ([image, name, category]) => {
    clearTimeout(coverPreviewTimer)
    if (image) {
      defaultCoverPreview.value = ''
      return
    }
    coverPreviewTimer = setTimeout(() => {
      defaultCoverPreview.value = createDefaultCoverDataUrl(name, category)
    }, COVER_PREVIEW_DELAY)
  },
  { immediate: true },
)

// An uploaded cover always wins over the generated one.
const coverPreview = computed(() => draft.value.quiz_image || defaultCoverPreview.value)

function wasAborted(controller) {
  return Boolean(controller?.signal.aborted)
}

async function onCoverPicked(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  // The presign rules are checked before the round trip, so a wrong file type
  // fails instantly and with a precise reason.
  const problem = checkImageFile(file)
  if (problem) {
    coverError.value = problem
    return
  }

  const controller = new AbortController()
  coverAbort?.abort()
  coverAbort = controller
  coverUploading.value = true
  coverError.value = ''

  try {
    draft.value.quiz_image = await uploadImage(file, 'quizzes', { signal: controller.signal })
  } catch (error) {
    // A cancelled upload is a user decision, not a failure to report.
    if (!wasAborted(controller)) {
      coverError.value = toErrorMessage(error, 'Could not upload the cover image.')
      ui.toast(coverError.value, 'error')
    }
  } finally {
    if (coverAbort === controller) {
      coverAbort = null
      coverUploading.value = false
    }
  }
}

function cancelCoverUpload() {
  coverAbort?.abort()
  coverAbort = null
  coverUploading.value = false
}

async function onQuestionImagePicked(question, event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  const problem = checkImageFile(file)
  if (problem) {
    question.uploadError = problem
    return
  }

  const controller = new AbortController()
  questionAborts.get(question.id)?.abort()
  questionAborts.set(question.id, controller)
  question.uploading = true
  question.uploadError = ''

  try {
    question.question_image = await uploadImage(file, 'questions', { signal: controller.signal })
  } catch (error) {
    if (!wasAborted(controller)) {
      question.uploadError = toErrorMessage(error, 'Could not upload the question image.')
      ui.toast(question.uploadError, 'error')
    }
  } finally {
    if (questionAborts.get(question.id) === controller) {
      questionAborts.delete(question.id)
      question.uploading = false
    }
  }
}

function cancelQuestionUpload(question) {
  questionAborts.get(question.id)?.abort()
  questionAborts.delete(question.id)
  question.uploading = false
}

// Leaving the editor must not keep uploads running against a gone component.
onBeforeUnmount(() => {
  clearTimeout(autosaveTimer)
  clearTimeout(coverPreviewTimer)
  coverAbort?.abort()
  questionAborts.forEach((controller) => controller.abort())
  questionAborts.clear()
})

/*
 * Every quiz ends up with a cover, whether the author picked one or not: the
 * generated one is drawn and uploaded here, at save time, so it is a real object
 * storage URL like any other image and every card, rail and lobby can use it.
 */
async function ensureCover() {
  if (draft.value.quiz_image) return

  const file = await createDefaultCoverFile(draft.value.quiz_name, draft.value.quiz_category)
  if (!file) return

  draft.value.quiz_image = await uploadImage(file, 'quizzes')
}

async function submit() {
  formError.value = ''
  showErrors.value = true

  if (allIssues.value.length) {
    ui.toast(allIssues.value[0], 'error')
    return
  }

  preparingCover.value = true
  try {
    await ensureCover()
  } catch (error) {
    // A decorative cover is not worth losing the quiz over: the author is told,
    // and the save goes ahead without one.
    ui.toast(toErrorMessage(error, 'Could not prepare a cover image. Saving without one.'), 'error')
  } finally {
    preparingCover.value = false
  }

  emit('submit', buildPayload(draft.value, items.value))
}

defineExpose({
  setError: (message) => (formError.value = message),
  // The page calls this after a successful save so the editor stops reporting
  // unsaved changes and drops its "draft saved" note.
  markSaved: () => {
    clearTimeout(autosaveTimer)
    savedLabel.value = ''
    showErrors.value = false
    emit('dirty', false)
  },
})
</script>

<template>
  <div>
    <header class="mb-lg flex flex-wrap items-center justify-end gap-sm">
      <button type="button" class="btn btn-ghost" @click="emit('cancel')">
        Cancel
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="busy || preparingCover"
        @click="submit"
      >
        {{ submitText }}
      </button>
    </header>

    <div
      v-if="formError || issues.length"
      class="mb-md rounded-md bg-red-50 px-md py-sm text-body-sm text-red-600"
    >
      <p v-if="formError">
        {{ formError }}
      </p>
      <ul v-if="issues.length" class="list-disc space-y-xxs pl-md">
        <li v-for="(issue, issueIndex) in issues" :key="issueIndex">
          {{ issue }}
        </li>
      </ul>
      <p v-if="hiddenIssueCount" class="mt-xxs">
        and {{ hiddenIssueCount }} more to fix.
      </p>
    </div>

    <p v-else-if="savedLabel" class="mb-md text-caption text-ink-faint">
      {{ savedLabel }}
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
        <!--
          The cover comes first: it is the only part of a quiz people see before
          opening it, so it is decided before the name rather than buried under the
          form.
        -->
        <div class="md:col-span-2">
          <span class="mb-xxs block text-caption text-ink-secondary">Cover image</span>

          <!--
            The image is the picker: a label around the hidden input, so a click
            anywhere on the cover opens the file dialog and there is no button to
            explain. Shown at 16:10 with the same height cap as the detail page, so
            the framing here is the framing everywhere.
          -->
          <label
            class="group relative flex aspect-[16/10] max-h-[400px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-canvas-soft ring-1 ring-hairline"
          >
            <img
              v-if="coverPreview"
              :src="coverPreview"
              alt="Quiz cover"
              class="h-full w-full object-cover"
            >

            <!--
              The prompt sits on the image: revealed on hover, and kept visible while
              uploading or when there is nothing to look at yet.
            -->
            <span
              class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-body-sm font-semibold text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100"
              :class="coverUploading || !coverPreview ? 'opacity-100' : ''"
            >
              {{
                coverUploading
                  ? 'Uploading…'
                  : draft.quiz_image
                    ? 'Click to replace the cover'
                    : 'Click to upload a cover'
              }}
            </span>

            <span
              v-if="coverPreview && !draft.quiz_image"
              class="chip absolute left-[12px] top-[12px]"
            >
              Generated cover
            </span>

            <input
              type="file"
              :accept="IMAGE_ACCEPT"
              class="hidden"
              :disabled="coverUploading"
              @change="onCoverPicked"
            >
          </label>

          <!-- Outside the label on purpose: a click here must not reopen the dialog -->
          <div class="mt-sm flex flex-wrap items-center gap-md">
            <button
              v-if="coverUploading"
              type="button"
              class="btn btn-ghost"
              @click="cancelCoverUpload"
            >
              Cancel upload
            </button>
            <button
              v-else-if="draft.quiz_image"
              type="button"
              class="btn btn-ghost"
              @click="draft.quiz_image = ''"
            >
              Remove image
            </button>
            <span class="text-caption text-ink-faint">
              JPG, PNG, GIF or WEBP up to 2MB, 1600×1000 for a cover that fits both the
              cards and this page. Left empty, one is generated from the quiz name when
              you save.
            </span>
          </div>
          <p v-if="coverError" class="mt-xxs text-caption text-ans-a">
            {{ coverError }}
          </p>
        </div>

        <label class="block md:col-span-2">
          <span class="mb-xxs block text-caption text-ink-secondary">Quiz name</span>
          <input
            v-model="draft.quiz_name"
            class="field"
            :class="quizErrors.quiz_name ? 'border-ans-a' : ''"
            type="text"
            :maxlength="LIMITS.nameMax"
            placeholder="e.g. World capitals in 60 seconds"
          >
          <span class="mt-xxs flex items-center justify-between gap-sm text-caption">
            <span class="text-ans-a">{{ quizErrors.quiz_name }}</span>
            <span class="text-ink-faint">
              {{ draft.quiz_name.length }}/{{ LIMITS.nameMax }}
            </span>
          </span>
        </label>

        <label class="block md:col-span-2">
          <span class="mb-xxs block text-caption text-ink-secondary">Description</span>
          <textarea
            v-model="draft.quiz_description"
            class="field min-h-[96px] resize-y"
            :class="quizErrors.quiz_description ? 'border-ans-a' : ''"
            :maxlength="LIMITS.descriptionMax"
            placeholder="Tell players what this quiz is about."
          />
          <span class="mt-xxs flex items-center justify-between gap-sm text-caption">
            <span class="text-ans-a">{{ quizErrors.quiz_description }}</span>
            <span class="text-ink-faint">
              {{ draft.quiz_description.length }}/{{ LIMITS.descriptionMax }}
            </span>
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
              :class="questionErrors[index].question_text ? 'border-ans-a' : ''"
              type="text"
              :maxlength="LIMITS.questionTextMax"
              placeholder="What do you want to ask?"
            >
            <span class="mt-xxs flex items-center justify-between gap-sm text-caption">
              <span class="text-ans-a">{{ questionErrors[index].question_text }}</span>
              <span class="text-ink-faint">
                {{ question.question_text.length }}/{{ LIMITS.questionTextMax }}
              </span>
            </span>
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

          <div class="flex flex-wrap items-end gap-sm">
            <label class="btn btn-utility cursor-pointer">
              {{ question.uploading ? 'Uploading…' : question.question_image ? 'Replace image' : 'Add image' }}
              <input
                type="file"
                :accept="IMAGE_ACCEPT"
                class="hidden"
                :disabled="question.uploading"
                @change="onQuestionImagePicked(question, $event)"
              >
            </label>
            <button
              v-if="question.uploading"
              type="button"
              class="btn btn-ghost"
              @click="cancelQuestionUpload(question)"
            >
              Cancel
            </button>
            <button
              v-else-if="question.question_image"
              type="button"
              class="btn btn-ghost"
              @click="question.question_image = ''"
            >
              Remove
            </button>
            <span v-if="question.uploadError" class="text-caption text-ans-a">
              {{ question.uploadError }}
            </span>
          </div>
        </div>

        <img
          v-if="question.question_image"
          :src="question.question_image"
          alt="Question illustration"
          class="mt-md h-[160px] w-full rounded-md object-cover ring-1 ring-hairline"
        >

        <!-- Optional coaching text: the hint is shown before answering, the
             explanation with the answer key -->
        <div class="mt-md grid gap-md md:grid-cols-2">
          <label class="block">
            <span class="mb-xxs block text-caption text-ink-secondary">
              Hint <span class="text-ink-faint">(optional)</span>
            </span>
            <input
              v-model="question.question_hint"
              class="field"
              :class="questionErrors[index].question_hint ? 'border-ans-a' : ''"
              type="text"
              :maxlength="LIMITS.hintMax"
              placeholder="Nudge players in the right direction."
            >
            <span class="mt-xxs flex items-center justify-between gap-sm text-caption">
              <span class="text-ans-a">{{ questionErrors[index].question_hint }}</span>
              <span class="text-ink-faint">
                {{ (question.question_hint || '').length }}/{{ LIMITS.hintMax }}
              </span>
            </span>
          </label>

          <label class="block">
            <span class="mb-xxs block text-caption text-ink-secondary">
              Explanation <span class="text-ink-faint">(optional)</span>
            </span>
            <input
              v-model="question.explanation"
              class="field"
              :class="questionErrors[index].explanation ? 'border-ans-a' : ''"
              type="text"
              :maxlength="LIMITS.explanationMax"
              placeholder="Why this answer is the right one."
            >
            <span class="mt-xxs flex items-center justify-between gap-sm text-caption">
              <span class="text-ans-a">{{ questionErrors[index].explanation }}</span>
              <span class="text-ink-faint">
                {{ (question.explanation || '').length }}/{{ LIMITS.explanationMax }}
              </span>
            </span>
          </label>
        </div>

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
            <div v-for="(option, optionIndex) in question.answer_options" :key="optionIndex">
              <div class="flex items-center gap-sm">
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
                  :class="questionErrors[index].options?.[optionIndex] ? 'border-ans-a' : ''"
                  type="text"
                  :maxlength="LIMITS.optionMax"
                  :placeholder="`Option ${optionIndex + 1}`"
                >
                <button
                  type="button"
                  class="btn btn-ghost shrink-0 px-sm"
                  :disabled="question.answer_options.length <= LIMITS.optionsMin"
                  :aria-label="`Remove option ${optionIndex + 1}`"
                  @click="removeOption(question, optionIndex)"
                >
                  ×
                </button>
              </div>
              <p
                v-if="questionErrors[index].options?.[optionIndex]"
                class="mt-xxs pl-[44px] text-caption text-ans-a"
              >
                {{ questionErrors[index].options[optionIndex] }}
              </p>
            </div>
          </div>

          <div class="mt-sm flex flex-wrap items-center justify-between gap-sm">
            <button
              type="button"
              class="btn btn-utility"
              :disabled="question.answer_options.length >= LIMITS.optionsMax"
              @click="addOption(question)"
            >
              + Add option
            </button>
            <span class="text-caption text-ink-faint">
              {{ question.answer_options.length }}/{{ LIMITS.optionsMax }} options, at least
              {{ LIMITS.optionsMin }} must be filled in
            </span>
          </div>

          <p
            v-if="questionErrors[index].answer_options || questionErrors[index].correct"
            class="mt-xxs text-caption text-ans-a"
          >
            {{ questionErrors[index].answer_options || questionErrors[index].correct }}
          </p>
        </div>

        <!-- Free text answers -->
        <label v-else class="mt-md block">
          <span class="mb-xxs block text-caption text-ink-secondary">Expected answer</span>
          <textarea
            v-if="question.question_type === 'long_answer'"
            v-model="question.correctText"
            class="field min-h-[88px] resize-y"
            :class="questionErrors[index].correct ? 'border-ans-a' : ''"
            placeholder="The answer players should write."
          />
          <input
            v-else
            v-model="question.correctText"
            class="field"
            :class="questionErrors[index].correct ? 'border-ans-a' : ''"
            type="text"
            placeholder="The answer players should write."
          >
          <span v-if="questionErrors[index].correct" class="mt-xxs block text-caption text-ans-a">
            {{ questionErrors[index].correct }}
          </span>
        </label>
      </article>
    </section>

    <div class="mt-lg flex flex-wrap items-center justify-between gap-md">
      <button type="button" class="btn btn-utility" @click="addQuestion">
        + Add question
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="busy || preparingCover"
        @click="submit"
      >
        {{ submitText }}
      </button>
    </div>
  </div>
</template>
