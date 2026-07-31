<script setup>
/**
 * Step 2 of quiz creation: the editor. It opens empty for the manual method, or
 * prefilled with whatever the importers on /create converted.
 */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createQuiz } from '@/api/quizzes.api'
import { toErrorMessage } from '@/api/envelope'
import { useUiStore } from '@/stores/ui.store'
import { takePendingDraft } from '@/composables/useQuizDraft'
import QuizEditor from '@/components/quiz/QuizEditor.vue'
import { makeQuestion, makeQuizMeta } from '@/utils/quizImport'

const router = useRouter()
const ui = useUiStore()

const quiz = ref(makeQuizMeta())
const questions = ref([makeQuestion()])
const saving = ref(false)
const importedCount = ref(0)

onMounted(() => {
  const draft = takePendingDraft()
  if (!draft?.questions.length) return
  quiz.value = draft.quiz
  questions.value = draft.questions
  importedCount.value = draft.questions.length
})

async function submit(payload) {
  saving.value = true
  try {
    const created = await createQuiz(payload)
    ui.toast('Your quiz has been created.', 'success')
    const id = created?.quiz_id ?? created?.id
    router.push(id ? { name: 'quiz-detail', params: { id } } : { name: 'library' })
  } catch (error) {
    ui.toast(toErrorMessage(error, 'Could not create the quiz.'), 'error')
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

    <QuizEditor
      :quiz="quiz"
      :questions="questions"
      :busy="saving"
      busy-label="Publishing…"
      submit-label="Publish quiz"
      eyebrow="Create"
      heading="Build a new quiz"
      @submit="submit"
      @cancel="router.push({ name: 'create-start' })"
    />
  </div>
</template>
