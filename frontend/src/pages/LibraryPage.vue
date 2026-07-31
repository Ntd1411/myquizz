<script setup>
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import QuizCard from '@/components/quiz/QuizCard.vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import { getQuizzesByOwner } from '@/api/quizzes.api'
import { useAuthStore } from '@/stores/auth.store'

// Guarded by requiresAuth, so auth.user is always present when this renders.
const auth = useAuthStore()

const query = useQuery({
  queryKey: computed(() => ['quizzes', 'owner', auth.user?.id]),
  queryFn: () => getQuizzesByOwner(auth.user.id, { page: 1, limit: 20 }),
  enabled: computed(() => Boolean(auth.user?.id)),
})

const quizzes = computed(() => query.data.value?.quizzes ?? [])
</script>

<template>
  <div class="container-page py-lg">
    <h1 class="section-title">My library</h1>
    <p class="mt-xxs text-body-sm text-ink-muted">Quizzes you created.</p>

    <div v-if="query.isLoading.value" class="flex justify-center py-xxl text-ink-muted">
      <BaseSpinner />
    </div>

    <p v-else-if="!quizzes.length" class="py-xxl text-body-sm text-ink-muted">
      You have not created any quiz yet.
    </p>

    <div v-else class="mt-lg grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
      <QuizCard v-for="quiz in quizzes" :key="quiz.id" :quiz="quiz" />
    </div>
  </div>
</template>
