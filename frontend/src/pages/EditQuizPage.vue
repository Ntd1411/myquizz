<script setup>
/**
 * Update page. It reuses the create editor and only differs in how the draft is
 * loaded (GET /quizzes/id/:id) and saved (PATCH, which replaces the whole
 * questions list).
 */
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getQuizById, updateQuiz } from '@/api/quizzes.api'
import { toErrorMessage } from '@/api/envelope'
import { useUiStore } from '@/stores/ui.store'
import QuizEditor from '@/components/quiz/QuizEditor.vue'
import { quizToDraft } from '@/utils/quizImport'

const route = useRoute()
const router = useRouter()
const ui = useUiStore()

const quizId = route.params.id
const quiz = ref(null)
const questions = ref(null)
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)

onMounted(async () => {
  try {
    const source = await getQuizById(quizId)
    const draft = quizToDraft(source)
    quiz.value = draft.quiz
    questions.value = draft.questions
  } catch (error) {
    loadError.value = toErrorMessage(error, 'Could not load this quiz.')
  } finally {
    loading.value = false
  }
})

async function submit(payload) {
  saving.value = true
  try {
    await updateQuiz(quizId, payload)
    ui.toast('Your changes have been saved.', 'success')
    router.push({ name: 'quiz-detail', params: { id: quizId } })
  } catch (error) {
    ui.toast(toErrorMessage(error, 'Could not save your changes.'), 'error')
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

    <QuizEditor
      v-else
      :quiz="quiz"
      :questions="questions"
      :busy="saving"
      busy-label="Saving…"
      submit-label="Save changes"
      eyebrow="Update"
      heading="Edit this quiz"
      @submit="submit"
      @cancel="router.push({ name: 'quiz-detail', params: { id: quizId } })"
    />
  </div>
</template>
