<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { getQuizById } from '@/api/quizzes.api'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { toErrorMessage } from '@/api/envelope'
import { revealOnEnter, revealOnScroll } from '@/composables/useMotion'

/**
 * Quiz detail: the read-only overview of a quiz before hosting or editing it.
 *
 * Answer visibility is a deliberate rule here. The owner is previewing their own
 * material, so correct answers are marked for them. For everybody else the options are
 * listed without any marking, otherwise this page would be a cheat sheet for a quiz
 * they are about to play.
 */
const props = defineProps({
  id: { type: String, required: true },
})

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

const pageEl = ref(null)
const listEl = ref(null)
// Question bodies stay collapsed by default so a 40-question quiz is still scannable.
const openIds = ref(new Set())

const query = useQuery({
  queryKey: computed(() => ['quiz', props.id]),
  queryFn: () => getQuizById(props.id),
})

const quiz = computed(() => query.data.value)
const questions = computed(() => quiz.value?.questions ?? [])

const QUESTION_TYPE_LABEL = {
  multiple_choice: 'Single choice',
  multiple_select: 'Multiple choice',
  short_answer: 'Short answer',
  long_answer: 'Long answer',
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

const isOwner = computed(() => {
  const ownerId = quiz.value?.ownerId ?? quiz.value?.owner_id ?? quiz.value?.owner?.id
  return Boolean(ownerId && auth.user?.id && String(ownerId) === String(auth.user.id))
})

const authorName = computed(
  () => quiz.value?.owner?.fullname || quiz.value?.ownerName || 'Unknown author',
)

const totalTime = computed(() =>
  questions.value.reduce((sum, question) => sum + (Number(question.time_limit) || 0), 0),
)

/** "3m 20s", or just seconds when it is under a minute. */
const totalTimeLabel = computed(() => {
  const seconds = totalTime.value
  if (!seconds) return '—'
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return minutes ? `${minutes}m${rest ? ` ${rest}s` : ''}` : `${rest}s`
})

/** How many questions of each type, shown as chips in the sidebar. */
const typeBreakdown = computed(() => {
  const counts = new Map()
  for (const question of questions.value) {
    const label = QUESTION_TYPE_LABEL[question.question_type] ?? question.question_type
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return Array.from(counts, ([label, count]) => ({ label, count }))
})

function questionKey(question, index) {
  return question.id ?? `q-${index}`
}

function isOpen(key) {
  return openIds.value.has(key)
}

function toggleQuestion(key) {
  // Reassigning the Set keeps the reactivity simple and predictable.
  const next = new Set(openIds.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  openIds.value = next
}

function expandAll() {
  openIds.value = new Set(questions.value.map((question, index) => questionKey(question, index)))
}

function collapseAll() {
  openIds.value = new Set()
}

/**
 * correct_answer is a union in the backend schema: an array of option indexes for
 * choice questions, or a plain string for typed answers.
 */
function correctIndexes(question) {
  const value = question.correct_answer ?? question.correctAnswer
  return Array.isArray(value) ? value.map(Number) : []
}

function correctText(question) {
  const value = question.correct_answer ?? question.correctAnswer
  return typeof value === 'string' ? value : ''
}

function isChoice(question) {
  return question.question_type === 'multiple_choice' || question.question_type === 'multiple_select'
}

function options(question) {
  return question.answer_options ?? question.answerOptions ?? []
}

function goEdit() {
  router.push({ name: 'edit-quiz', params: { id: props.id } })
}

function hostGame() {
  // Live hosting needs the socket screen, which is the next milestone.
  ui.toast('Live hosting is coming in the next phase.')
}

function goPlay() {
  router.push({ name: 'join-game' })
}

onMounted(() => revealOnEnter(pageEl.value))

// Questions arrive with the query, so the scroll reveals can only be wired afterwards.
watch(
  questions,
  async (list) => {
    if (!list.length) return
    await nextTick()
    revealOnScroll(listEl.value, '[data-reveal]', { y: 18, stagger: 0.04 })
  },
  { immediate: true },
)
</script>

<template>
  <div ref="pageEl" class="container-page pb-xxl pt-lg">
    <div v-if="query.isLoading.value" class="flex justify-center py-xxl text-ink-muted">
      <BaseSpinner />
    </div>

    <div v-else-if="query.isError.value" class="card-surface mt-lg p-xl">
      <h1 class="text-heading-3 text-ink">This quiz is not available</h1>
      <p class="mt-xs text-body-sm text-ink-muted">
        {{ toErrorMessage(query.error.value, 'It may have been deleted or made private.') }}
      </p>
      <div class="mt-md flex items-center gap-xs">
        <button class="btn-utility" type="button" @click="query.refetch()">Try again</button>
        <RouterLink :to="{ name: 'discover' }" class="btn-ghost">Browse quizzes</RouterLink>
      </div>
    </div>

    <template v-else-if="quiz">
      <div class="flex flex-col gap-lg lg:flex-row lg:items-start">
        <!-- Main column -->
        <div class="lg:w-2/3">
          <div data-enter>
            <p v-if="quiz.category" class="eyebrow-label">{{ quiz.category }}</p>
            <h1 class="mt-xxs text-heading-1 text-ink">{{ quiz.title }}</h1>
            <p v-if="quiz.description" class="mt-sm text-body-md text-ink-secondary">
              {{ quiz.description }}
            </p>

            <div class="mt-md flex flex-wrap items-center gap-xs text-caption text-ink-muted">
              <span>{{ questions.length }} questions</span>
              <span aria-hidden="true">·</span>
              <span>{{ totalTimeLabel }} total</span>
              <span aria-hidden="true">·</span>
              <span>By {{ authorName }}</span>
              <span v-if="quiz.isPublic === false" class="chip">Private</span>
            </div>
          </div>

          <div class="mt-lg flex items-center justify-between gap-sm" data-enter>
            <h2 class="text-heading-3 text-ink">Questions</h2>
            <div v-if="questions.length" class="flex items-center gap-xs">
              <button class="btn-ghost" type="button" @click="expandAll">Expand all</button>
              <button class="btn-ghost" type="button" @click="collapseAll">Collapse all</button>
            </div>
          </div>

          <p v-if="!questions.length" class="mt-sm text-body-sm text-ink-faint">
            This quiz has no questions yet.
          </p>

          <ol v-else ref="listEl" class="mt-sm flex flex-col gap-xs">
            <li
              v-for="(question, i) in questions"
              :key="questionKey(question, i)"
              class="question-card"
              data-reveal
            >
              <button
                class="question-head"
                type="button"
                :aria-expanded="isOpen(questionKey(question, i))"
                @click="toggleQuestion(questionKey(question, i))"
              >
                <span class="question-index">{{ i + 1 }}</span>

                <span class="min-w-0 flex-1">
                  <span class="block text-body-md font-medium text-ink">{{ question.question_text }}</span>
                  <span class="mt-xxs flex flex-wrap items-center gap-xs text-caption text-ink-faint">
                    <span>{{ QUESTION_TYPE_LABEL[question.question_type] ?? question.question_type }}</span>
                    <span aria-hidden="true">·</span>
                    <span>{{ question.time_limit ?? 30 }}s</span>
                    <span v-if="isChoice(question)" aria-hidden="true">·</span>
                    <span v-if="isChoice(question)">{{ options(question).length }} options</span>
                  </span>
                </span>

                <span
                  class="question-caret"
                  :class="isOpen(questionKey(question, i)) ? 'is-open' : ''"
                  aria-hidden="true"
                >
                  ›
                </span>
              </button>

              <div v-if="isOpen(questionKey(question, i))" class="question-body">
                <ul v-if="isChoice(question)" class="grid gap-xs sm:grid-cols-2">
                  <li
                    v-for="(option, index) in options(question)"
                    :key="`${questionKey(question, i)}-${index}`"
                    class="option-row"
                    :class="isOwner && correctIndexes(question).includes(index) ? 'is-correct' : ''"
                  >
                    <span class="option-letter">{{ OPTION_LETTERS[index] ?? index + 1 }}</span>
                    <span class="min-w-0 flex-1 text-body-sm text-ink">{{ option }}</span>
                    <span
                      v-if="isOwner && correctIndexes(question).includes(index)"
                      class="text-caption font-medium text-sticker-green"
                    >
                      Correct
                    </span>
                  </li>
                </ul>

                <div v-else class="rounded-md border border-hairline bg-canvas-soft p-sm">
                  <p class="text-caption text-ink-muted">Players type their answer.</p>
                  <p v-if="isOwner && correctText(question)" class="mt-xxs text-body-sm text-ink">
                    Expected answer: {{ correctText(question) }}
                  </p>
                </div>

                <p v-if="!isOwner" class="mt-xs text-caption text-ink-faint">
                  Correct answers are hidden until you play.
                </p>
              </div>
            </li>
          </ol>
        </div>

        <!-- Sidebar -->
        <aside class="lg:w-1/3" data-enter>
          <div class="card-surface sticky top-[88px] p-lg">
            <img
              v-if="quiz.image"
              :src="quiz.image"
              :alt="quiz.title"
              class="mb-md h-[140px] w-full rounded-md object-cover"
            />

            <dl class="grid gap-xs">
              <div class="flex items-center justify-between gap-sm">
                <dt class="text-caption text-ink-muted">Questions</dt>
                <dd class="text-body-sm text-ink">{{ questions.length }}</dd>
              </div>
              <div class="flex items-center justify-between gap-sm">
                <dt class="text-caption text-ink-muted">Total time</dt>
                <dd class="text-body-sm text-ink">{{ totalTimeLabel }}</dd>
              </div>
              <div v-if="quiz.language" class="flex items-center justify-between gap-sm">
                <dt class="text-caption text-ink-muted">Language</dt>
                <dd class="text-body-sm text-ink">{{ quiz.language }}</dd>
              </div>
              <div v-if="quiz.playCount != null" class="flex items-center justify-between gap-sm">
                <dt class="text-caption text-ink-muted">Plays</dt>
                <dd class="text-body-sm text-ink">{{ quiz.playCount }}</dd>
              </div>
            </dl>

            <div v-if="typeBreakdown.length" class="mt-md flex flex-wrap gap-xxs">
              <span v-for="entry in typeBreakdown" :key="entry.label" class="chip">
                {{ entry.count }} {{ entry.label }}
              </span>
            </div>

            <div class="mt-md grid gap-xs">
              <button class="btn-primary w-full" type="button" @click="hostGame">Host a game</button>
              <button class="btn-utility w-full" type="button" @click="goPlay">Join with a code</button>
              <button v-if="isOwner" class="btn-ghost w-full" type="button" @click="goEdit">
                Edit this quiz
              </button>
            </div>

            <p class="mt-xs text-caption text-ink-faint">
              Live hosting arrives with the realtime game screen.
            </p>
          </div>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.question-card {
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  background-color: var(--surface);
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;
}

.question-card:hover {
  border-color: var(--ink-faint);
  box-shadow: var(--shadow-1);
}

.question-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  text-align: left;
}

.question-index {
  display: grid;
  place-items: center;
  flex: 0 0 26px;
  height: 26px;
  border-radius: var(--r-full);
  background-color: var(--canvas-soft);
  color: var(--ink-muted);
  font-size: 13px;
  font-weight: 600;
}

.question-caret {
  color: var(--ink-faint);
  transition: transform 150ms ease;
}

.question-caret.is-open {
  transform: rotate(90deg);
}

.question-body {
  padding: 0 16px 16px 54px;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--hairline);
  border-radius: var(--r-md);
}

.option-row.is-correct {
  border-color: rgba(26, 174, 57, 0.5);
  background-color: rgba(26, 174, 57, 0.08);
}

.option-letter {
  display: grid;
  place-items: center;
  flex: 0 0 22px;
  height: 22px;
  border-radius: var(--r-full);
  background-color: var(--canvas-soft);
  color: var(--ink-muted);
  font-size: 12px;
  font-weight: 600;
}

@media (max-width: 620px) {
  .question-body {
    padding-left: 16px;
  }
}
</style>
