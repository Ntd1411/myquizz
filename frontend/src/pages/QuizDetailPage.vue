<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { getQuizById } from '@/api/quizzes.api'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import UserAvatar from '@/components/base/UserAvatar.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { toErrorMessage } from '@/api/envelope'
import { createDefaultCoverDataUrl } from '@/utils/defaultCover'
import { revealOnEnter, revealOnScroll } from '@/composables/useMotion'

/**
 * Quiz detail: the read-only overview of a quiz before hosting or editing it.
 *
 * Two stacked full-width sections, the quiz and then its questions. Nothing
 * collapses: a list of headers hides exactly what the reader opened the page for.
 * The answer key is the one thing kept behind a switch, and that switch works the
 * same for the owner and for a visitor, so opening a quiz you are about to play is
 * never an accidental spoiler.
 */
const props = defineProps({
  id: { type: String, required: true },
})

const auth = useAuthStore()
const ui = useUiStore()
const router = useRouter()

const pageEl = ref(null)
const listEl = ref(null)
// Answers stay hidden until they are asked for, and then for the whole quiz.
const showAnswers = ref(false)

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

const authorAvatar = computed(() => quiz.value?.owner?.avatar ?? '')

/*
 * Quizzes saved before covers were generated still have none, and an empty band
 * at the top of the page reads as a broken image. The same drawing the editor
 * uploads on save is produced here for display only, so the page always opens on
 * something deliberate.
 */
const coverSrc = computed(() => {
  const current = quiz.value
  if (!current) return ''
  return current.imageUrl || createDefaultCoverDataUrl(current.title, current.category)
})

/*
 * The author block only becomes a link when the id is known: a quiz whose author
 * row was soft deleted still shows the neutral name, without a route to nowhere.
 */
const authorLink = computed(() => {
  const ownerId = quiz.value?.owner?.id ?? quiz.value?.ownerId
  return ownerId ? { name: 'user-profile', params: { id: String(ownerId) } } : null
})

const totalTime = computed(() =>
  questions.value.reduce((sum, question) => sum + (Number(question.timeLimit) || 0), 0),
)

/** "3m 20s", or just seconds when it is under a minute. */
const totalTimeLabel = computed(() => {
  const seconds = totalTime.value
  if (!seconds) return '—'
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return minutes ? `${minutes}m${rest ? ` ${rest}s` : ''}` : `${rest}s`
})

/** How many questions of each type, shown as chips under the quiz identity. */
const typeBreakdown = computed(() => {
  const counts = new Map()
  for (const question of questions.value) {
    const label = QUESTION_TYPE_LABEL[question.type] ?? question.type
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  return Array.from(counts, ([label, count]) => ({ label, count }))
})

function questionKey(question, index) {
  return question.id ?? `q-${index}`
}

function toggleAnswers() {
  showAnswers.value = !showAnswers.value
}

/*
 * correct_answer is a union in the backend schema: option indexes for choice
 * questions, a plain string for typed answers. api/quiz.mapper.js has already
 * split it into two predictable fields, so this page never has to guess.
 */
function correctIndexes(question) {
  return Array.isArray(question.correctIndexes) ? question.correctIndexes : []
}

function correctText(question) {
  return typeof question.correctText === 'string' ? question.correctText : ''
}

function isChoice(question) {
  return question.type === 'multiple_choice' || question.type === 'multiple_select'
}

function options(question) {
  return question.options ?? []
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
      <h1 class="text-heading-3 text-ink">
        This quiz is not available
      </h1>
      <p class="mt-xs text-body-sm text-ink-muted">
        {{ toErrorMessage(query.error.value, 'It may have been deleted or made private.') }}
      </p>
      <div class="mt-md flex items-center gap-xs">
        <button class="btn-utility" type="button" @click="query.refetch()">
          Try again
        </button>
        <RouterLink :to="{ name: 'discover' }" class="btn-ghost">
          Browse quizzes
        </RouterLink>
      </div>
    </div>

    <template v-else-if="quiz">
      <!-- The quiz itself: cover, identity, counters and every action -->
      <section class="card-surface overflow-hidden" data-enter>
        <img
          v-if="coverSrc"
          :src="coverSrc"
          :alt="quiz.title"
          class="aspect-[16/10] max-h-[400px] w-full object-cover"
        >

        <div class="p-lg">
          <p v-if="quiz.category" class="eyebrow-label">
            {{ quiz.category }}
          </p>
          <h1 class="mt-xxs text-heading-1 text-ink">
            {{ quiz.title }}
          </h1>
          <p v-if="quiz.description" class="mt-sm max-w-[70ch] text-body-md text-ink-secondary">
            {{ quiz.description }}
          </p>

          <div class="mt-md flex flex-wrap items-center gap-md">
            <RouterLink
              v-if="authorLink"
              :to="authorLink"
              class="flex items-center gap-xs text-ink transition-colors duration-150 hover:text-primary"
            >
              <UserAvatar :name="authorName" :src="authorAvatar" :size="34" />
              <span class="text-body-sm font-medium">{{ authorName }}</span>
            </RouterLink>
            <span v-else class="flex items-center gap-xs">
              <UserAvatar :name="authorName" :src="authorAvatar" :size="34" />
              <span class="text-body-sm text-ink-muted">{{ authorName }}</span>
            </span>

            <span class="flex flex-wrap items-center gap-xs text-caption text-ink-muted">
              <span>{{ questions.length }} questions</span>
              <span aria-hidden="true">·</span>
              <span>{{ totalTimeLabel }} total</span>
              <template v-if="quiz.language">
                <span aria-hidden="true">·</span>
                <span>{{ quiz.language }}</span>
              </template>
              <template v-if="quiz.playCount != null">
                <span aria-hidden="true">·</span>
                <span>{{ quiz.playCount }} plays</span>
              </template>
              <span v-if="quiz.isPublic === false" class="chip">Private</span>
            </span>
          </div>

          <div v-if="typeBreakdown.length" class="mt-md flex flex-wrap gap-xxs">
            <span v-for="entry in typeBreakdown" :key="entry.label" class="chip">
              {{ entry.count }} {{ entry.label }}
            </span>
          </div>

          <div class="mt-lg flex flex-wrap items-center gap-xs">
            <button class="btn btn-primary" type="button" @click="hostGame">
              Host a game
            </button>
            <button class="btn btn-utility" type="button" @click="goPlay">
              Join with a code
            </button>
            <button v-if="isOwner" class="btn btn-ghost" type="button" @click="goEdit">
              Edit this quiz
            </button>
          </div>

          <p class="mt-xs text-caption text-ink-faint">
            Live hosting arrives with the realtime game screen.
          </p>
        </div>
      </section>

      <!-- Every question, always expanded -->
      <section class="mt-lg">
        <div class="flex flex-wrap items-center justify-between gap-sm" data-enter>
          <h2 class="text-heading-3 text-ink">
            Questions
          </h2>
          <button
            v-if="questions.length"
            class="btn btn-utility"
            type="button"
            :aria-pressed="showAnswers"
            @click="toggleAnswers"
          >
            {{ showAnswers ? 'Hide correct answers' : 'Show correct answers' }}
          </button>
        </div>

        <p v-if="!questions.length" class="mt-sm text-body-sm text-ink-faint">
          This quiz has no questions yet.
        </p>

        <ol v-else ref="listEl" class="mt-sm flex flex-col gap-sm">
          <li
            v-for="(question, i) in questions"
            :key="questionKey(question, i)"
            class="question-card"
            data-reveal
          >
            <div class="question-head">
              <span class="question-index">{{ i + 1 }}</span>
              <div class="min-w-0 flex-1">
                <p class="text-body-md font-medium text-ink">
                  {{ question.text }}
                </p>
                <p class="mt-xxs flex flex-wrap items-center gap-xs text-caption text-ink-faint">
                  <span>{{ QUESTION_TYPE_LABEL[question.type] ?? question.type }}</span>
                  <span aria-hidden="true">·</span>
                  <span>{{ question.timeLimit ?? 30 }}s</span>
                  <template v-if="isChoice(question)">
                    <span aria-hidden="true">·</span>
                    <span>{{ options(question).length }} options</span>
                  </template>
                </p>
              </div>
            </div>

            <div class="question-body">
              <img
                v-if="question.imageUrl"
                :src="question.imageUrl"
                :alt="question.text"
                class="mb-sm h-[200px] w-full rounded-md object-cover"
              >

              <ul v-if="isChoice(question)" class="grid gap-xs sm:grid-cols-2">
                <li
                  v-for="(option, index) in options(question)"
                  :key="`${questionKey(question, i)}-${index}`"
                  class="option-row"
                  :class="showAnswers && correctIndexes(question).includes(index) ? 'is-correct' : ''"
                >
                  <span class="option-letter">{{ OPTION_LETTERS[index] ?? index + 1 }}</span>
                  <span class="min-w-0 flex-1 text-body-sm text-ink">{{ option.text }}</span>
                  <span
                    v-if="showAnswers && correctIndexes(question).includes(index)"
                    class="text-caption font-medium text-sticker-green"
                  >
                    Correct
                  </span>
                </li>
              </ul>

              <div v-else class="rounded-md border border-hairline bg-canvas-soft p-sm">
                <p class="text-caption text-ink-muted">
                  Players type their answer.
                </p>
                <p v-if="showAnswers && correctText(question)" class="mt-xxs text-body-sm text-ink">
                  Expected answer: {{ correctText(question) }}
                </p>
              </div>

              <!-- A hint is meant to be read before answering, so it is never hidden. -->
              <p v-if="question.hint" class="mt-xs text-caption text-ink-muted">
                Hint: {{ question.hint }}
              </p>

              <p
                v-if="showAnswers && question.explanation"
                class="mt-xxs text-caption text-ink-muted"
              >
                Explanation: {{ question.explanation }}
              </p>
              <p v-else-if="!showAnswers" class="mt-xs text-caption text-ink-faint">
                Correct answers are hidden.
              </p>
            </div>
          </li>
        </ol>
      </section>
    </template>
  </div>
</template>

<style scoped>
.question-card {
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  background-color: var(--surface);
}

/* The header is no longer a button: nothing on this card collapses. */
.question-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px 0;
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

.question-body {
  padding: 12px 16px 16px 54px;
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
