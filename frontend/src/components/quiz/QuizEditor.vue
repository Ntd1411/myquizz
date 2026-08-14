<script setup>
/**
 * Shared quiz editor used by both the create and the update page. It owns its own
 * working copy of the draft and only emits a validated payload upwards, so the
 * pages stay thin (load / save / redirect).
 */
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { IMAGE_ACCEPT, checkImageFile, uploadImage } from '@/api/storage.api'
import { toErrorMessage } from '@/api/envelope'
import { saveAutoDraft } from '@/composables/useQuizDraft'
import { createDefaultCoverDataUrl, createDefaultCoverFile } from '@/utils/defaultCover'
import { useUiStore } from '@/stores/ui.store'
import BaseCombo from '@/components/base/BaseCombo.vue'
import BrandLogo from '@/components/base/BrandLogo.vue'
import ImageCropper from '@/components/quiz/ImageCropper.vue'
import {
  CATEGORIES,
  LANGUAGES,
  LIMITS,
  QUESTION_TYPES,
  TIME_LIMITS,
  buildPayload,
  clampTimeLimit,
  errorMessages,
  isChoice,
  makeQuestion,
  makeQuizMeta,
  validateQuizFields,
} from '@/utils/quizImport'
import { QUESTION_HEIGHT, QUESTION_WIDTH } from '@/utils/imageCrop'

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
 * Category and time limit are dropdowns that can become an input: BaseCombo keeps the list
 * for the answers nearly every quiz uses and turns its own box into an empty one when the
 * author picks Custom, so nothing unfolds underneath the field.
 */
const categoryOptions = CATEGORIES.map((category) => ({ value: category, label: category }))

// The list stops at 120 seconds; a typed limit is held to the range LIMITS owns, the same
// one the import validator checks and the backend schema enforces, so the three cannot
// drift apart the way three separate pairs of numbers did.
const TIME_LIMIT_MIN = LIMITS.timeMin
const TIME_LIMIT_MAX = LIMITS.timeMax

const timeOptions = TIME_LIMITS.map((seconds) => ({
  value: seconds,
  label: `${seconds} seconds`,
}))

/**
 * Held to the range when the field is left, not on every keystroke: typing "9" on the
 * way to "90" must not be corrected to the minimum under the author's fingers.
 */
function clampTime(question) {
  question.time_limit = clampTimeLimit(question.time_limit)
}

/*
 * Errors are computed continuously but only revealed once the author has tried
 * to save: marking every empty field red on an untouched form is noise, and
 * hiding the reason for a blocked save is worse.
 *
 * There is no list of problems at the top of the page. It repeated what the marked
 * fields already say, and five sentences stacked above a long form read as a wall
 * rather than as directions: a refused save names the first problem in a toast, and
 * every field carries its own message where the fix has to happen.
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

/*
 * A picture that is already stored comes along with the copy, because it is only a URL on
 * the question. One that is still waiting in the browser does not: it is held against a
 * question id, and uploading a single file under two keys is not what Duplicate promises.
 */
function duplicateQuestion(index) {
  const source = items.value[index]
  items.value.splice(index + 1, 0, {
    ...source,
    id: makeQuestion().id,
    answer_options: [...source.answer_options],
    correctIndexes: [...source.correctIndexes],
  })
}

function removeQuestion(index) {
  if (items.value.length === 1) return

  // A pending picture is keyed by question id, so it has to leave with the question or it
  // would hold an object URL open and be uploaded for a question that no longer exists.
  setPendingImage(items.value[index], null)
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
 * A cover chosen here stays in the browser until the quiz is saved: it is validated and
 * previewed locally, and only presigned and uploaded by submit(). Nothing reaches object
 * storage for a quiz that is abandoned, and replacing or re-cropping the cover any
 * number of times still costs exactly one upload.
 *
 * Errors are reported next to the picker instead of only as a toast, which disappears
 * before the author can act on it.
 */
const coverError = ref('')
// The file input is opened from the icon button on the cover, so the preview no longer
// has to be one giant label to be usable.
const coverInput = ref(null)
const cropOpen = ref(false)

/*
 * The pending cover, held as three separate things on purpose:
 *  - source: the picture as the author supplied it, so every crop is taken from the
 *    original instead of from the last crop, which would shed a little more of the
 *    image on each pass.
 *  - crop: the frame of the last crop, so the cropper reopens on it and a crop that was
 *    tightened too far can be widened again.
 *  - file / previewUrl: what will be uploaded on save, and what the preview shows now.
 */
const pendingCover = ref(null)

/*
 * The same arrangement for question pictures, keyed by question id and deliberately kept
 * outside `items`: a File cannot survive JSON, so holding one on the question itself would
 * put an empty object into the autosaved draft and a restored question would look as
 * though it still carried a picture.
 */
const pendingImages = reactive(new Map())
// Which question the open cropper belongs to, so only one dialog can exist at a time.
const cropQuestionId = ref(null)

// Every deferred upload happens inside the save, so one flag covers the cover and the
// question pictures alike. The submit button says so rather than looking stuck.
const preparingCover = ref(false)

// The cover no longer has an upload of its own to wait on: the only busy state it can
// be in is the save that uploads it.
const coverBusy = computed(() => props.busy || preparingCover.value)

const submitText = computed(() => {
  if (props.busy) return props.busyLabel
  return preparingCover.value ? 'Uploading images…' : props.submitLabel
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

/*
 * What the author is looking at: the cover just picked or cropped, then the one already
 * stored on the quiz, then the generated one.
 */
const coverPreview = computed(
  () => pendingCover.value?.previewUrl || draft.value.quiz_image || defaultCoverPreview.value,
)

// The cropper always reads the original picture, never the result of the last crop.
const cropSource = computed(
  () => pendingCover.value?.sourceUrl || draft.value.quiz_image || defaultCoverPreview.value,
)

/** Frees the object URLs a pending image holds. One URL may fill both slots. */
function releasePendingImage(pending) {
  if (!pending) return

  const urls = new Set()
  if (pending.previewIsLocal) urls.add(pending.previewUrl)
  if (pending.sourceIsLocal) urls.add(pending.sourceUrl)
  urls.forEach((url) => URL.revokeObjectURL(url))
}

function setPendingCover(next) {
  releasePendingImage(pendingCover.value)
  pendingCover.value = next
  // The cover lives outside `draft`, so the watcher that tracks edits cannot see it and
  // the page has to be told, or it would let the author leave without a warning.
  emit('dirty', true)
}

function openCoverPicker() {
  coverInput.value?.click()
}

/*
 * Picking validates and previews, nothing more. The file is kept as it came so a later
 * crop can read it without a download, and the presign happens once, in submit().
 */
function onCoverPicked(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  // Checked now rather than at save time: a file the bucket would reject has to be
  // reported while the author is still looking at the picker.
  const problem = checkImageFile(file)
  if (problem) {
    coverError.value = problem
    return
  }

  coverError.value = ''
  // One URL in both slots: an untouched pick is its own preview, and releaseCover()
  // revokes it exactly once.
  const url = URL.createObjectURL(file)
  setPendingCover({
    file,
    sourceUrl: url,
    sourceIsLocal: true,
    previewUrl: url,
    previewIsLocal: true,
    crop: null,
  })
}

/*
 * The cropper reads the original picture, the generated preview included: a quiz that
 * started without a cover can still end up with one the author framed themselves.
 */
function openCropper() {
  if (!cropSource.value || coverBusy.value) return

  coverError.value = ''
  cropOpen.value = true
}

/*
 * A crop is stored, not uploaded. Both the source and the frame are kept: reopening the
 * cropper returns to this framing, and the next crop is taken from the original rather
 * than from this output.
 */
function onCropApplied({ file, crop }) {
  cropOpen.value = false

  const current = pendingCover.value
  const previewUrl = URL.createObjectURL(file)

  if (current) {
    // Only the output changes here, so the source and its URL have to survive: revoking
    // the old preview is safe only when it is not the source itself.
    if (current.previewIsLocal && current.previewUrl !== current.sourceUrl) {
      URL.revokeObjectURL(current.previewUrl)
    }
    pendingCover.value = { ...current, file, previewUrl, previewIsLocal: true, crop }
    emit('dirty', true)
    return
  }

  // Cropping a cover that is already stored, or the generated one: that URL becomes the
  // source and the crop becomes the first pending upload.
  setPendingCover({
    file,
    sourceUrl: cropSource.value,
    sourceIsLocal: false,
    previewUrl,
    previewIsLocal: true,
    crop,
  })
}

/** Drops the pending cover and the stored one, back to the generated preview. */
function removeCover() {
  setPendingCover(null)
  draft.value.quiz_image = ''
}

/*
 * What one question shows now, and what its cropper should read: the pending pick first,
 * then whatever is already stored on the question.
 */
function questionPreview(question) {
  return pendingImages.get(question.id)?.previewUrl || question.question_image || ''
}

function questionCropSource(question) {
  return pendingImages.get(question.id)?.sourceUrl || question.question_image || ''
}

function setPendingImage(question, next) {
  releasePendingImage(pendingImages.get(question.id))
  if (next) pendingImages.set(question.id, next)
  else pendingImages.delete(question.id)
  // Held outside `items`, so the watcher that tracks edits cannot see this one either.
  emit('dirty', true)
}

/*
 * A question picture behaves exactly like the cover now: picking validates and previews
 * it and nothing more. Abandoning the editor uploads nothing, and replacing or
 * re-cropping the picture any number of times still costs one upload.
 */
function onQuestionImagePicked(question, event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  const problem = checkImageFile(file)
  if (problem) {
    question.uploadError = problem
    return
  }

  question.uploadError = ''
  // One URL in both slots: an untouched pick is its own preview.
  const url = URL.createObjectURL(file)
  setPendingImage(question, {
    file,
    sourceUrl: url,
    sourceIsLocal: true,
    previewUrl: url,
    previewIsLocal: true,
    crop: null,
  })
}

function openQuestionCropper(question) {
  if (!questionCropSource(question) || props.busy) return

  question.uploadError = ''
  cropQuestionId.value = question.id
}

/*
 * As with the cover: the crop is stored rather than uploaded, the original is kept so the
 * next crop is taken from it instead of from this output, and the frame is kept so the
 * cropper reopens where the author left it.
 */
function onQuestionCropApplied(question, { file, crop }) {
  cropQuestionId.value = null

  const current = pendingImages.get(question.id)
  const previewUrl = URL.createObjectURL(file)

  if (current) {
    // Only the output changes, so the source URL has to survive: revoking the old preview
    // is safe only when it is not the source itself.
    if (current.previewIsLocal && current.previewUrl !== current.sourceUrl) {
      URL.revokeObjectURL(current.previewUrl)
    }
    pendingImages.set(question.id, { ...current, file, previewUrl, previewIsLocal: true, crop })
    emit('dirty', true)
    return
  }

  // Cropping a picture that is already stored: that URL becomes the source.
  setPendingImage(question, {
    file,
    sourceUrl: question.question_image,
    sourceIsLocal: false,
    previewUrl,
    previewIsLocal: true,
    crop,
  })
}

function removeQuestionImage(question) {
  setPendingImage(question, null)
  question.question_image = ''
  question.uploadError = ''
}

/*
 * The optional coaching text is folded away by default, but not when it would hide
 * something: a hint that already exists, or a message about a value that is too long.
 */
function optionsOpen(question, errors) {
  return Boolean(
    question.question_hint || question.explanation || errors.question_hint || errors.explanation,
  )
}

// Leaving the editor must not leak the object URLs its previews are holding.
onBeforeUnmount(() => {
  clearTimeout(autosaveTimer)
  clearTimeout(coverPreviewTimer)
  releasePendingImage(pendingCover.value)
  pendingImages.forEach(releasePendingImage)
  pendingImages.clear()
})

/*
 * Save time is the only moment the editor writes to object storage: the cover the author
 * picked is presigned and uploaded here, and the pending state is dropped once it holds
 * a real URL.
 */
async function uploadPendingCover() {
  const pending = pendingCover.value
  if (!pending) return

  draft.value.quiz_image = await uploadImage(pending.file, 'quizzes')
  setPendingCover(null)
}

/*
 * The same for every question picture waiting in the browser. They go up together rather
 * than one after another: a quiz with a picture on ten questions would otherwise make the
 * author sit through ten round trips in a row.
 *
 * Each question is cleared as its own upload lands, so a failure part way through keeps
 * what already succeeded and the next save retries only what is missing.
 */
async function uploadPendingImages() {
  const waiting = items.value.filter((question) => pendingImages.has(question.id))
  if (!waiting.length) return

  await Promise.all(
    waiting.map(async (question) => {
      const pending = pendingImages.get(question.id)
      question.question_image = await uploadImage(pending.file, 'questions')
      setPendingImage(question, null)
    }),
  )
}

/*
 * Every quiz ends up with a cover, whether the author picked one or not: the
 * generated one is drawn and uploaded here, at save time, so it is a real object
 * storage URL like any other image and every card, rail and lobby can use it.
 *
 * The upload is remembered by what the picture is drawn from. A save that the API then
 * refuses, or a second save after an edit that left the name and the category alone, reuses
 * the URL instead of leaving another unreferenced PNG behind in the quizzes/ folder. A
 * rename does change the drawing, so that one is uploaded again on purpose.
 */
let generatedCover = { signature: '', url: '' }

async function ensureCover() {
  if (draft.value.quiz_image) return

  const signature = JSON.stringify([draft.value.quiz_name, draft.value.quiz_category])
  if (generatedCover.url && generatedCover.signature === signature) {
    draft.value.quiz_image = generatedCover.url
    return
  }

  const file = await createDefaultCoverFile(draft.value.quiz_name, draft.value.quiz_category)
  if (!file) return

  const url = await uploadImage(file, 'quizzes')
  generatedCover = { signature, url }
  draft.value.quiz_image = url
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
    // Independent uploads, and the author is waiting on all of them.
    await Promise.all([uploadPendingCover(), uploadPendingImages()])
  } catch (error) {
    // The author chose these pictures, so saving without them would throw their choice
    // away silently: the save stops and every pending file is kept for a retry.
    preparingCover.value = false
    formError.value = toErrorMessage(error, 'Could not upload the images. Nothing was saved.')
    ui.toast(formError.value, 'error')
    return
  }

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
    <!--
      The autosave line sits in the row it reports on, opposite the button that ends the
      same piece of work. On a line of its own it pushed the whole form down every time
      the timestamp appeared.
    -->
    <header class="mb-lg flex flex-wrap items-center justify-end gap-sm">
      <p v-if="savedLabel" class="mr-auto text-caption text-ink-faint">
        {{ savedLabel }}
      </p>
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

    <!--
      Only the failure of the save itself is announced here. The list of validation
      problems that used to sit in this spot said nothing the marked fields do not
      already say, so a refused save toasts the first one instead.
    -->
    <p
      v-if="formError"
      class="mb-md rounded-md bg-red-50 px-md py-sm text-body-sm text-red-600"
    >
      {{ formError }}
    </p>

    <!-- Quiz metadata -->
    <section class="card-surface mb-lg p-lg">
      <div class="mb-md flex items-center gap-sm">
        <BrandLogo variant="mark" :size="22" />
        <h2 class="text-heading-3 text-ink">
          Quiz details
        </h2>
        <span class="ml-auto text-caption text-ink-faint">
          <span class="text-ans-a">*</span> required
        </span>
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
            The cover is a preview, not a control: the two icon buttons in the corner
            name what can be done with it, so nothing rests on guessing that the image
            itself is clickable. Shown at 16:10 with the same height cap as the detail
            page, so the framing here is the framing everywhere.
          -->
          <div
            class="group relative flex aspect-[16/10] max-h-[400px] w-full items-center justify-center overflow-hidden rounded-lg bg-canvas-soft ring-1 ring-hairline"
          >
            <img
              v-if="coverPreview"
              :src="coverPreview"
              alt="Quiz cover"
              class="h-full w-full object-cover"
            >
            <span v-else class="text-body-sm text-ink-faint">
              No cover yet
            </span>

            <!--
              A scrim on the bottom edge only, fading upwards into nothing. Its job is to
              keep the two controls legible over a bright photograph, so it must not dim
              the picture the author is judging.
            -->
            <div
              class="pointer-events-none absolute inset-x-0 bottom-0 h-[96px] bg-gradient-to-t from-black/55 via-black/20 to-transparent opacity-0 transition-opacity duration-ui ease-ui group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100"
              :class="preparingCover ? 'opacity-100' : ''"
            />

            <p
              v-if="preparingCover"
              class="absolute bottom-[18px] left-[16px] text-caption font-semibold text-white"
            >
              Uploading cover…
            </p>

            <!--
              Revealed with the scrim, but always visible below md: a touch screen has no
              hover to reveal them with.
            -->
            <div
              class="absolute bottom-[12px] right-[12px] flex items-center gap-xs opacity-0 transition-opacity duration-ui ease-ui group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100"
              :class="preparingCover ? 'opacity-100' : ''"
            >
              <button
                type="button"
                class="icon-btn-overlay"
                title="Upload a new image"
                aria-label="Upload a new image"
                :disabled="coverBusy"
                @click="openCoverPicker"
              >
                <svg
                  class="h-[18px] w-[18px]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 16V4M7 9l5-5 5 5" />
                  <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                </svg>
              </button>
              <button
                type="button"
                class="icon-btn-overlay"
                title="Crop the current image to 1600×1000"
                aria-label="Crop the current image"
                :disabled="coverBusy || !cropSource"
                @click="openCropper"
              >
                <svg
                  class="h-[18px] w-[18px]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M7 3v14h14" />
                  <path d="M3 7h14v14" />
                </svg>
              </button>
              <button
                v-if="pendingCover || draft.quiz_image"
                type="button"
                class="icon-btn-overlay"
                title="Remove this image"
                aria-label="Remove this image"
                :disabled="coverBusy"
                @click="removeCover"
              >
                <svg
                  class="h-[18px] w-[18px]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 7h16M10 11v6M14 11v6" />
                  <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
                </svg>
              </button>
            </div>

            <input
              ref="coverInput"
              type="file"
              :accept="IMAGE_ACCEPT"
              class="hidden"
              :disabled="coverBusy"
              @change="onCoverPicked"
            >
          </div>

          <p class="mt-sm text-caption text-ink-faint">
            JPG, PNG, GIF or WEBP up to 2MB, stored at 1600×1000 so one file serves both
            the cards and this page. Left empty, one is generated from the quiz name.
          </p>

          <p v-if="pendingCover" class="mt-xxs text-caption text-ink-secondary">
            This image is still only in your browser — it is uploaded when you save.
          </p>
          <p v-if="coverError" class="mt-xxs text-caption text-ans-a">
            {{ coverError }}
          </p>

          <!--
            The original picture and the frame of the last crop: the cropper resumes the
            previous framing rather than starting over, and never crops its own output.
          -->
          <ImageCropper
            v-if="cropOpen"
            title="Crop the cover image"
            :src="cropSource"
            :crop="pendingCover?.crop || null"
            @apply="onCropApplied"
            @cancel="cropOpen = false"
          />
        </div>

        <label class="block md:col-span-2">
          <span class="mb-xxs block text-caption text-ink-secondary">
            Quiz name <span class="text-ans-a" aria-hidden="true">*</span>
          </span>
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

        <div>
          <label class="block">
            <span class="mb-xxs block text-caption text-ink-secondary">Category</span>
            <BaseCombo
              v-model="draft.quiz_category"
              :options="categoryOptions"
              :invalid="Boolean(quizErrors.quiz_category)"
              :maxlength="LIMITS.categoryMax"
              custom-placeholder="Name your own category"
            />
          </label>

          <span v-if="quizErrors.quiz_category" class="mt-xxs block text-caption text-ans-a">
            {{ quizErrors.quiz_category }}
          </span>
        </div>

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
            <span class="mb-xxs block text-caption text-ink-secondary">
              Question <span class="text-ans-a" aria-hidden="true">*</span>
            </span>
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

          <div>
            <label class="block">
              <span class="mb-xxs block text-caption text-ink-secondary">
                Time limit <span class="text-ans-a" aria-hidden="true">*</span>
              </span>
              <BaseCombo
                v-model="question.time_limit"
                :options="timeOptions"
                :invalid="Boolean(questionErrors[index].time_limit)"
                type="number"
                :min="TIME_LIMIT_MIN"
                :max="TIME_LIMIT_MAX"
                :custom-placeholder="`Seconds, ${TIME_LIMIT_MIN} to ${TIME_LIMIT_MAX}`"
                @blur="clampTime(question)"
              />
            </label>
            <span
              v-if="questionErrors[index].time_limit"
              class="mt-xxs block text-caption text-ans-a"
            >
              {{ questionErrors[index].time_limit }}
            </span>
          </div>

          <div class="flex flex-wrap items-end gap-sm">
            <!--
              Until there is a picture this is the only control. Once there is one, the
              preview below carries the actions and this cell steps out of the way.
            -->
            <label
              v-if="!questionPreview(question)"
              class="btn btn-utility cursor-pointer"
              :class="busy ? 'pointer-events-none opacity-50' : ''"
            >
              Add image
              <input
                type="file"
                :accept="IMAGE_ACCEPT"
                class="hidden"
                :disabled="busy"
                @change="onQuestionImagePicked(question, $event)"
              >
            </label>
            <span v-if="question.uploadError" class="text-caption text-ans-a">
              {{ question.uploadError }}
            </span>
          </div>
        </div>

        <!--
          Treated exactly like the cover: the picture is its own control, with a scrim on
          the bottom edge and the actions in the corner, revealed on hover and always
          visible on a touch screen. Shown at 16:9, the ratio it is stored at.
        -->
        <div
          v-if="questionPreview(question)"
          class="group relative mt-md aspect-[16/9] max-h-[280px] w-full overflow-hidden rounded-md bg-canvas-soft ring-1 ring-hairline"
        >
          <img
            :src="questionPreview(question)"
            alt="Question illustration"
            class="h-full w-full object-cover"
          >

          <div
            class="pointer-events-none absolute inset-x-0 bottom-0 h-[80px] bg-gradient-to-t from-black/55 via-black/20 to-transparent opacity-0 transition-opacity duration-ui ease-ui group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100"
          />

          <div
            class="absolute bottom-[12px] right-[12px] flex items-center gap-xs opacity-0 transition-opacity duration-ui ease-ui group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100"
          >
            <!-- A label rather than a button, because the file input has to be its child. -->
            <label
              class="icon-btn-overlay cursor-pointer"
              :class="busy ? 'pointer-events-none opacity-50' : ''"
              title="Upload a new image"
              aria-label="Upload a new image"
            >
              <svg
                class="h-[18px] w-[18px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M12 16V4M7 9l5-5 5 5" />
                <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
              </svg>
              <input
                type="file"
                :accept="IMAGE_ACCEPT"
                class="hidden"
                :disabled="busy"
                @change="onQuestionImagePicked(question, $event)"
              >
            </label>
            <button
              type="button"
              class="icon-btn-overlay"
              :title="`Crop the current image to ${QUESTION_WIDTH}×${QUESTION_HEIGHT}`"
              aria-label="Crop the current image"
              :disabled="busy"
              @click="openQuestionCropper(question)"
            >
              <svg
                class="h-[18px] w-[18px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M7 3v14h14" />
                <path d="M3 7h14v14" />
              </svg>
            </button>
            <button
              type="button"
              class="icon-btn-overlay"
              title="Remove this image"
              aria-label="Remove this image"
              :disabled="busy"
              @click="removeQuestionImage(question)"
            >
              <svg
                class="h-[18px] w-[18px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M4 7h16M10 11v6M14 11v6" />
                <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
              </svg>
            </button>
          </div>
        </div>

        <p v-if="pendingImages.has(question.id)" class="mt-xxs text-caption text-ink-faint">
          This image is still only in your browser — it is uploaded when you save.
        </p>

        <!-- One cropper at a time: cropQuestionId names the question it belongs to. -->
        <ImageCropper
          v-if="cropQuestionId === question.id"
          title="Crop the question image"
          :src="questionCropSource(question)"
          :crop="pendingImages.get(question.id)?.crop || null"
          :width="QUESTION_WIDTH"
          :height="QUESTION_HEIGHT"
          @apply="onQuestionCropApplied(question, $event)"
          @cancel="cropQuestionId = null"
        />

        <!--
          The hint is shown before answering and the explanation with the answer key, and
          most questions use neither: folded away, they stop competing with the question
          and its answers for the author's attention. It is forced open when it would
          otherwise hide text that already exists or a problem that blocks the save.
        -->
        <details :open="optionsOpen(question, questionErrors[index])" class="mt-md">
          <summary class="cursor-pointer text-caption text-ink-secondary">
            Options
          </summary>

          <div class="mt-md grid gap-md md:grid-cols-2">
            <label class="block">
              <span class="mb-xxs block text-caption text-ink-secondary">Hint</span>
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
              <span class="mb-xxs block text-caption text-ink-secondary">Explanation</span>
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
        </details>

        <!-- Choice answers -->
        <div v-if="isChoice(question.question_type)" class="mt-md">
          <p class="mb-xxs text-caption text-ink-secondary">
            {{
              question.question_type === 'multiple_choice'
                ? 'Answer options — tick the single correct one'
                : 'Answer options — tick every correct one'
            }}
            <span class="text-ans-a" aria-hidden="true">*</span>
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
          <span class="mb-xxs block text-caption text-ink-secondary">
            Expected answer <span class="text-ans-a" aria-hidden="true">*</span>
          </span>
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
