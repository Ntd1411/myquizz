<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuery, keepPreviousData } from '@tanstack/vue-query'
import QuizCard from '@/components/quiz/QuizCard.vue'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import { searchQuizzes } from '@/api/quizzes.api'
import { revealOnScroll } from '@/composables/useMotion'

const route = useRoute()
const router = useRouter()

const keyword = ref(route.query.keyword ?? '')
const category = ref(route.query.category ?? '')
const page = ref(Number(route.query.page ?? 1))

// Backend caps limit at 20.
const LIMIT = 12

// Sticker swatches are decoration only, matching the home rails.
const CATEGORIES = [
  { name: 'General', color: '#615d59' },
  { name: 'Science', color: '#2a9d99' },
  { name: 'Geography', color: '#1aae39' },
  { name: 'Movies', color: '#dd5b00' },
  { name: 'Sports', color: '#ff64c8' },
  { name: 'Music', color: '#391c57' },
]

const gridEl = ref(null)

const query = useQuery({
  queryKey: computed(() => ['quizzes', 'search', keyword.value, category.value, page.value]),
  queryFn: () =>
    searchQuizzes({ keyword: keyword.value, category: category.value, page: page.value, limit: LIMIT }),
  placeholderData: keepPreviousData,
})

const quizzes = computed(() => query.data.value?.quizzes ?? [])
const pagination = computed(() => query.data.value?.pagination)

// Keep the URL shareable.
watch([keyword, category, page], () => {
  router.replace({
    name: 'discover',
    query: {
      keyword: keyword.value || undefined,
      category: category.value || undefined,
      page: page.value > 1 ? page.value : undefined,
    },
  })
})

// Any filter change must restart pagination.
watch([keyword, category], () => {
  page.value = 1
})

function selectCategory(value) {
  category.value = category.value === value ? '' : value
}

onMounted(() => {
  revealOnScroll(gridEl.value, '[data-reveal]', { y: 20, stagger: 0.04 })
})
</script>

<template>
  <div ref="gridEl" class="container-page py-lg">
    <h1 class="section-title" data-reveal>Discover</h1>

    <div class="mt-md flex flex-col gap-sm" data-reveal>
      <input v-model.trim="keyword" class="field max-w-md" type="search" placeholder="Search by keyword…" />

      <div class="flex flex-wrap gap-[10px]">
        <button
          v-for="item in CATEGORIES"
          :key="item.name"
          type="button"
          class="chip"
          :class="category === item.name ? 'border-primary text-primary' : ''"
          @click="selectCategory(item.name)"
        >
          <span class="h-[9px] w-[9px] rounded-full" :style="{ backgroundColor: item.color }"></span>
          {{ item.name }}
        </button>
      </div>
    </div>

    <div v-if="query.isLoading.value" class="flex justify-center py-xxl text-ink-muted">
      <BaseSpinner />
    </div>

    <p v-else-if="query.isError.value" class="py-xxl text-body-sm text-sticker-orange-deep">
      Could not load quizzes.
    </p>

    <p v-else-if="!quizzes.length" class="py-xxl text-body-sm text-ink-muted">
      No quizzes match these filters.
    </p>

    <div v-else class="mt-lg grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4">
      <QuizCard v-for="quiz in quizzes" :key="quiz.id" :quiz="quiz" />
    </div>

    <div v-if="pagination && pagination.totalPages > 1" class="mt-lg flex items-center justify-center gap-sm">
      <button class="btn-utility" type="button" :disabled="!pagination.hasPreviousPage" @click="page -= 1">
        Previous
      </button>
      <span class="text-caption text-ink-muted">Page {{ pagination.page }} of {{ pagination.totalPages }}</span>
      <button class="btn-utility" type="button" :disabled="!pagination.hasNextPage" @click="page += 1">
        Next
      </button>
    </div>
  </div>
</template>
