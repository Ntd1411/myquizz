<script setup>
/**
 * Step 2 of quiz creation: the editor. It opens empty for the manual method, or
 * prefilled with whatever the importers on /create converted.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { createQuiz } from '@/api/quizzes.api'
import { toErrorMessage } from '@/api/envelope'
import {
  clearAutoDraft,
  draftKey,
  readAutoDraft,
  takePendingDraft,
} from '@/composables/useQuizDraft'
import QuizEditor from '@/components/quiz/QuizEditor.vue'
import { makeQuestion, makeQuizMeta } from '@/utils/quizImport'

const router = useRouter()

const AUTOSAVE_KEY = draftKey()

const editor = ref(null)
const quiz = ref(makeQuizMeta())
const questions = ref([makeQuestion()])
const saving = ref(false)
const importedCount = ref(0)
const dirty = ref(false)
// An autosaved draft is offered, never applied on its own: the author may well
// have come back to start something new.
const recovered = ref(null)

onMounted(() => {
  const draft = takePendingDraft()
  if (draft?.questions.length) {
    quiz.value = draft.quiz
    questions.value = draft.questions
    importedCount.value = draft.questions.length
    // An import replaces everything, so an older autosave would only confuse.
    clearAutoDraft(AUTOSAVE_KEY)
    return
  }

  const saved = readAutoDraft(AUTOSAVE_KEY)
  if (saved?.questions.length) recovered.value = saved
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

/*
 * Unsaved work is protected twice: the router guard covers in-app navigation and
 * the native prompt covers closing or reloading the tab.
 */
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
  return window.confirm('This quiz has not been published yet. Leave and keep the local draft?')
})

async function submit(payload) {
  saving.value = true
  try {
    const created = await createQuiz(payload)
    // The draft only exists to survive an accident; a published quiz is the copy
    // that matters from here on.
    clearAutoDraft(AUTOSAVE_KEY)
    dirty.value = false
    editor.value?.markSaved()
    // The quiz page it opens on is the confirmation, and it shows the real thing.
    router.push(
      created?.id ? { name: 'quiz-detail', params: { id: created.id } } : { name: 'library' },
    )
  } catch (error) {
    // The editor keeps the message next to the form the author is still looking at,
    // which is where the work that failed to save still is.
    editor.value?.setError(toErrorMessage(error, 'Could not create the quiz.'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="container-page py-xl">
    <p
      v-if="importedCount"
      class="mb-md rounded-md bg-canvas-soft px-md py-sm text-body-sm text-ink-secondary"
    >
      {{ importedCount }} imported question{{ importedCount === 1 ? '' : 's' }} are ready — review
      them before publishing.
    </p>

    <div
      v-if="recovered"
      class="mb-md flex flex-wrap items-center justify-between gap-sm rounded-md bg-canvas-soft px-md py-sm"
    >
      <p class="text-body-sm text-ink-secondary">
        An unfinished quiz from {{ recoveredLabel() }} is saved on this device
        ({{ recovered.questions.length }} question{{ recovered.questions.length === 1 ? '' : 's' }}).
      </p>
      <div class="flex items-center gap-sm">
        <button type="button" class="btn btn-utility" @click="restoreDraft">
          Restore it
        </button>
        <button type="button" class="btn btn-ghost" @click="discardDraft">
          Start fresh
        </button>
      </div>
    </div>

    <QuizEditor
      ref="editor"
      :quiz="quiz"
      :questions="questions"
      :busy="saving"
      :autosave-key="AUTOSAVE_KEY"
      busy-label="Publishing…"
      submit-label="Publish quiz"
      @submit="submit"
      @dirty="dirty = $event"
      @cancel="router.push({ name: 'create-start' })"
    />
  </div>
</template>
