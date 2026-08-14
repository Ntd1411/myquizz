<script setup>
/**
 * Update page. It reuses the create editor and only differs in how the draft is
 * loaded (GET /quizzes/id/:id) and saved (PATCH, which replaces the whole
 * questions list).
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { getQuizById, updateQuiz } from '@/api/quizzes.api'
import { ApiError, toErrorMessage } from '@/api/envelope'
import { useUiStore } from '@/stores/ui.store'
import { clearAutoDraft, draftKey, readAutoDraft } from '@/composables/useQuizDraft'
import QuizEditor from '@/components/quiz/QuizEditor.vue'
import { quizToDraft } from '@/utils/quizImport'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()

const quizId = route.params.id
const AUTOSAVE_KEY = draftKey(quizId)

const editor = ref(null)
const quiz = ref(null)
const questions = ref(null)
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const dirty = ref(false)
const recovered = ref(null)

/** ApiError carries the status itself, an axios failure carries it on the response. */
function statusOf(error) {
  if (error instanceof ApiError) return error.status
  return error?.response?.status
}

/*
 * A deleted quiz and a quiz owned by somebody else are different problems with
 * different next steps, so they never share one vague message.
 */
function loadFailureMessage(error) {
  const status = statusOf(error)
  if (status === 404) return 'This quiz no longer exists.'
  if (status === 403) return 'This quiz belongs to someone else, so it cannot be edited here.'
  if (status === 401) return 'Please sign in again to edit this quiz.'
  return toErrorMessage(error, 'Could not load this quiz.')
}

onMounted(async () => {
  try {
    const source = await getQuizById(quizId)
    const draft = quizToDraft(source)
    quiz.value = draft.quiz
    questions.value = draft.questions

    // The server copy is loaded first and stays on screen; an unsaved local draft
    // is only offered, because it may be older than what somebody already saved.
    const saved = readAutoDraft(AUTOSAVE_KEY)
    if (saved?.questions.length) recovered.value = saved
  } catch (error) {
    loadError.value = loadFailureMessage(error)
  } finally {
    loading.value = false
  }
})

const recoveredLabel = () => new Date(recovered.value.savedAt).toLocaleString()

function restoreDraft() {
  quiz.value = recovered.value.quiz
  questions.value = recovered.value.questions
  recovered.value = null
}

function discardDraft() {
  clearAutoDraft(AUTOSAVE_KEY)
  recovered.value = null
}

function warnBeforeUnload(event) {
  if (!dirty.value) return
  event.preventDefault()
  // Chrome only shows its own prompt when returnValue is set.
  event.returnValue = ''
}

window.addEventListener('beforeunload', warnBeforeUnload)
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnBeforeUnload))

onBeforeRouteLeave(() => {
  if (!dirty.value) return true
  return window.confirm('Your changes have not been saved. Leave and keep the local draft?')
})

async function submit(payload) {
  saving.value = true
  try {
    await updateQuiz(quizId, payload)
    clearAutoDraft(AUTOSAVE_KEY)
    dirty.value = false
    editor.value?.markSaved()
    ui.toast('Your changes have been saved.', 'success')
    router.push({ name: 'quiz-detail', params: { id: quizId } })
  } catch (error) {
    const status = statusOf(error)
    const message =
      status === 403
        ? 'You are not allowed to edit this quiz.'
        : status === 404
          ? 'This quiz no longer exists.'
          : toErrorMessage(error, 'Could not save your changes.')
    editor.value?.setError(message)
    ui.toast(message, 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="container-page py-xl">
    <p v-if="loading" class="text-body-sm text-ink-muted">
      Loading the quiz…
    </p>

    <div v-else-if="loadError" class="card-surface p-lg">
      <p class="text-body-sm text-red-600">
        {{ loadError }}
      </p>
      <button type="button" class="btn btn-utility mt-md" @click="router.push({ name: 'library' })">
        Back to my library
      </button>
    </div>

    <template v-else>
      <div
        v-if="recovered"
        class="mb-md flex flex-wrap items-center justify-between gap-sm rounded-md bg-canvas-soft px-md py-sm"
      >
        <p class="text-body-sm text-ink-secondary">
          Unsaved changes from {{ recoveredLabel() }} are stored on this device
          ({{ recovered.questions.length }} question{{ recovered.questions.length === 1 ? '' : 's' }}).
        </p>
        <div class="flex items-center gap-sm">
          <button type="button" class="btn btn-utility" @click="restoreDraft">
            Restore them
          </button>
          <button type="button" class="btn btn-ghost" @click="discardDraft">
            Keep the saved version
          </button>
        </div>
      </div>

      <QuizEditor
        ref="editor"
        :quiz="quiz"
        :questions="questions"
        :busy="saving"
        :autosave-key="AUTOSAVE_KEY"
        busy-label="Saving…"
        submit-label="Save changes"
        @submit="submit"
        @dirty="dirty = $event"
        @cancel="router.push({ name: 'quiz-detail', params: { id: quizId } })"
      />
    </template>
  </div>
</template>
