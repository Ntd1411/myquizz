<script setup>
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { getQuizById } from '@/api/quizzes.api'
import BaseSpinner from '@/components/base/BaseSpinner.vue'

const props = defineProps({
  id: { type: String, required: true },
})

const query = useQuery({
  queryKey: computed(() => ['quiz', props.id]),
  queryFn: () => getQuizById(props.id),
})

const quiz = computed(() => query.data.value)

const QUESTION_TYPE_LABEL = {
  multiple_choice: 'Single choice',
  multiple_select: 'Multiple choice',
  short_answer: 'Short answer',
  long_answer: 'Long answer',
}
</script>

<template>
  <div class="container-page py-lg">
    <div v-if="query.isLoading.value" class="flex justify-center py-xxl text-ink-muted">
      <BaseSpinner />
    </div>

    <p v-else-if="query.isError.value" class="py-xxl text-body-sm text-sticker-orange-deep">
      This quiz could not be found.
    </p>

    <template v-else-if="quiz">
      <div class="flex flex-col gap-lg lg:flex-row">
        <div class="lg:w-2/3">
          <p v-if="quiz.category" class="eyebrow-label">{{ quiz.category }}</p>
          <h1 class="mt-xxs text-heading-1 text-ink">{{ quiz.title }}</h1>
          <p v-if="quiz.description" class="mt-sm text-body-md text-ink-secondary">{{ quiz.description }}</p>

          <div class="mt-lg">
            <h2 class="text-heading-3 text-ink">Questions</h2>
            <ol class="mt-sm flex flex-col gap-xs">
              <li
                v-for="(question, i) in quiz.questions ?? []"
                :key="question.id ?? i"
                class="card-surface p-sm"
              >
                <p class="text-body-md font-medium text-ink">{{ i + 1 }}. {{ question.question_text }}</p>
                <p class="mt-xxs text-caption text-ink-muted">
                  {{ QUESTION_TYPE_LABEL[question.question_type] ?? question.question_type }}
                  <!-- The correct answer is intentionally never rendered here. -->
                </p>
              </li>
            </ol>
          </div>
        </div>

        <aside class="lg:w-1/3">
          <div class="card-surface sticky top-24 p-md">
            <p class="text-caption text-ink-muted">{{ (quiz.questions ?? []).length }} questions</p>
            <p v-if="quiz.language" class="mt-xxs text-caption text-ink-muted">Language: {{ quiz.language }}</p>
            <button class="btn-primary mt-md w-full" type="button" disabled>
              Host a game
            </button>
            <p class="mt-xs text-caption text-ink-faint">
              Hosting and live play are coming in the next phase.
            </p>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>
