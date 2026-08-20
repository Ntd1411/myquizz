<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { getQuizById } from '@/api/quizzes.api'
import BaseSpinner from '@/components/base/BaseSpinner.vue'
import StateBlock from '@/components/base/StateBlock.vue'
import GameShell from '@/components/game/GameShell.vue'
import QuestionStage from '@/components/game/QuestionStage.vue'
import PreviewSummaryView from '@/components/game/PreviewSummaryView.vue'
import { usePreviewGame } from '@/composables/usePreviewGame'
import { toErrorMessage } from '@/api/envelope'
import { useAuthStore } from '@/stores/auth.store'

/**
 * "Try it yourself": the quiz played alone, in this tab, against nothing.
 *
 * The route is public, exactly like the quiz page it is reached from. GET /quizzes/id/:id
 * already returns `correct_answer` for a public quiz to anyone, and answers a private one
 * with 404 unless the caller owns it, so the visibility rule is the API's and this screen
 * adds none of its own: whoever can read the quiz can rehearse it.
 *
 * No room is created and nothing is written: see composables/usePreviewGame.js for what
 * that costs (a local clock, and a score that is an estimate).
 *
 * The site header and footer are dropped through `meta.bare` and GameShell, for the same
 * reason a live match drops them - while a question is on the clock, a click into
 * Discover is never what the reader meant. There is no banner across the top either: the
 * screen is opened in its own tab and the summary is where the estimate is explained, so
 * a permanent strip would only steal room from the question.
 */
const props = defineProps({
  id: { type: String, required: true },
})

const router = useRouter()
const auth = useAuthStore()

const query = useQuery({
  queryKey: computed(() => ['quiz', props.id]),
  queryFn: () => getQuizById(props.id),
})

const quiz = computed(() => query.data.value ?? null)
const questions = computed(() => quiz.value?.questions ?? [])

const isOwner = computed(() => {
  const ownerId = quiz.value?.ownerId ?? quiz.value?.owner?.id
  return Boolean(ownerId && auth.user?.id && String(ownerId) === String(auth.user.id))
})

const game = usePreviewGame(() => quiz.value)

const isText = computed(() =>
  ['short_answer', 'long_answer'].includes(game.question.value?.type),
)
const isMulti = computed(() => game.question.value?.type === 'multiple_select')

const timeLeft = computed(() => game.secondsLeft.value)
const urgent = computed(
  () => game.phase.value === 'question' && timeLeft.value !== null && timeLeft.value <= 5,
)

const canSubmit = computed(() => {
  if (!game.canAnswer.value) return false
  return isText.value ? game.text.value.trim().length > 0 : game.selected.value.length > 0
})

const verdict = computed(() => {
  const row = game.answered.value
  if (!row) return null
  if (!row.answered) return 'missed'
  return row.is_correct ? 'correct' : 'wrong'
})

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

/**
 * The answer key written out, for the reveal after a question that was missed.
 *
 * A green tile is enough when the reader got it right, but a wrong answer is exactly the
 * moment the key has to be readable: a highlight is easy to miss on a screen that moves
 * on by itself, and a typed question has no tiles to highlight in the first place.
 */
const correctLabel = computed(() => {
  const current = game.question.value
  if (!current) return ''

  const indexes = Array.isArray(current.correctIndexes) ? current.correctIndexes : []
  if (indexes.length) {
    return indexes
      .map((position) => {
        const option = (current.options ?? []).find((entry) => entry.index === position)
        const letter = LETTERS[position] ?? String(position + 1)
        return option?.text ? `${letter}. ${option.text}` : letter
      })
      .join(' · ')
  }

  return current.correctText || ''
})

// The quiz arrives after the page does, so the run starts on the data, not on mount.
watch(
  questions,
  (rows) => {
    if (rows.length && game.phase.value === 'idle') game.start()
  },
  { immediate: true },
)

function exit() {
  game.stop()
  router.push({ name: 'quiz-detail', params: { id: props.id } })
}

/**
 * Keys are part of playing fast: 1-6 pick an option, Enter sends a built answer or moves
 * on from the reveal. Typing an answer owns the keyboard, so digits are left alone while
 * a text field has focus.
 */
function onKeydown(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return

  const target = event.target
  const typing = target instanceof HTMLElement &&
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)

  if (event.key === 'Escape') {
    exit()
    return
  }

  if (event.key === 'Enter') {
    if (game.phase.value === 'results') {
      game.next()
      return
    }
    if (canSubmit.value) game.submit()
    return
  }

  if (typing || !game.canAnswer.value) return

  const position = Number(event.key)
  if (!Number.isInteger(position) || position < 1) return

  const option = game.stageQuestion.value?.answer_options?.[position - 1]
  if (!option) return
  event.preventDefault()
  game.pick(option.id)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <GameShell bleed>
    <div v-if="query.isLoading.value" class="flex grow items-center justify-center">
      <BaseSpinner />
    </div>

    <StateBlock
      v-else-if="query.isError.value"
      variant="error"
      icon="&#9888;"
      title="This quiz is not available"
      :message="toErrorMessage(query.error.value, 'It may have been deleted or made private.')"
      action-label="Try again"
      @action="query.refetch()"
    />

    <StateBlock
      v-else-if="!questions.length"
      title="Nothing to play yet"
      message="This quiz has no questions, so there is nothing to preview."
      action-label="Back to the quiz"
      @action="exit"
    />

    <!-- The run itself: countdown, question, reveal, summary. -->
    <div v-else class="flex grow flex-col gap-sm">
      <section v-if="game.phase.value === 'countdown'" class="play-center">
        <p class="eyebrow-label">
          Get ready
        </p>
        <p class="num mt-md text-[96px] leading-none text-ink">
          {{ timeLeft ?? 0 }}
        </p>
        <p class="mt-sm text-body-md text-ink-2">
          {{ quiz?.title }}
        </p>
      </section>

      <PreviewSummaryView
        v-else-if="game.phase.value === 'finished'"
        :rows="game.rows.value"
        :score="game.score.value"
        :correct-count="game.correctCount.value"
        :answered-count="game.answeredCount.value"
        :total="game.total.value"
        :accuracy="game.accuracy.value"
        :elapsed-seconds="game.elapsedSeconds.value"
        :can-edit="isOwner"
        :quiz-id="props.id"
        @restart="game.restart()"
        @exit="exit"
      />

      <template v-else-if="game.stageQuestion.value">
        <header class="play-bar">
          <p class="stage-count">
            <span class="eyebrow-label">Question</span>
            <span class="num text-ink">{{ game.index.value + 1 }}</span>
            <span class="text-ink-3">/ {{ game.total.value }}</span>
          </p>

          <p
            v-if="timeLeft !== null"
            class="num play-clock"
            :class="{ 'is-urgent': urgent, 'is-late': game.isLate.value }"
          >
            {{ game.isLate.value ? 'Late' : `${timeLeft}s` }}
          </p>

          <div class="flex items-center gap-sm">
            <p class="play-score">
              <span class="num">{{ game.score.value }}</span>
              <span class="text-caption text-ink-3">pts (estimate)</span>
            </p>

            <!-- The only way out that is not a keystroke, now that the banner is gone. -->
            <button class="btn-ghost" type="button" @click="exit">
              Exit
            </button>
          </div>
        </header>

        <div class="track">
          <div
            class="track-fill"
            :class="{ 'is-urgent': urgent }"
            :style="{ width: `${Math.round(game.progress.value * 100)}%` }"
          />
        </div>

        <main class="play-main">
          <div class="stage-inner">
            <QuestionStage
              :question="game.stageQuestion.value"
              :selected="game.selected.value"
              :correct-answer="game.correctAnswer.value"
              :reveal="game.revealed.value"
              :multi="isMulti"
              :disabled="!game.canAnswer.value"
              @pick="game.pick"
            />

            <label v-if="isText" class="mt-lg block">
              <span class="mb-xs block text-body-sm font-medium text-ink-2">Your answer</span>
              <input
                v-model="game.text.value"
                class="field"
                type="text"
                :disabled="!game.canAnswer.value"
                autocomplete="off"
                @keyup.enter="game.submit()"
              >
            </label>

            <button
              v-if="(isMulti || isText) && game.canAnswer.value"
              class="btn-primary mt-md w-full"
              type="button"
              :disabled="!canSubmit"
              @click="game.submit()"
            >
              Submit answer
            </button>
          </div>
        </main>

        <footer class="play-foot">
          <!--
            allowAnswerLate is on, so a spent clock is a price rather than a door closing.
            Saying so is the point: a score that quietly drops is worse than one that
            explains itself.
          -->
          <p v-if="game.isLate.value && game.canAnswer.value" class="late-note">
            Time is up, but the answer still counts - for 10% less.
          </p>

          <div v-if="verdict" class="verdict" :class="`is-${verdict}`">
            <span class="verdict-mark">
              {{ verdict === 'correct' ? '&#10003;' : verdict === 'wrong' ? '&#10007;' : '&#8987;' }}
            </span>
            <span class="verdict-text">
              <span class="verdict-title">
                {{ verdict === 'correct' ? 'Correct' : verdict === 'wrong' ? 'Not this time' : 'Out of time' }}
              </span>
              <span v-if="game.answered.value?.score_earned" class="num verdict-score">
                +{{ game.answered.value.score_earned }}
              </span>
              <span v-if="game.answered.value?.is_late" class="verdict-note">
                answered late
              </span>
            </span>
          </div>

          <!--
            Shown for anything that was not answered correctly - wrong, skipped or out of
            time - because that is the one case where the reveal has to teach something.
          -->
          <p
            v-if="game.revealed.value && verdict !== 'correct' && correctLabel"
            class="answer-key"
          >
            <span class="eyebrow-label">Correct answer</span>
            <span class="answer-key-text">{{ correctLabel }}</span>
          </p>

          <p
            v-if="game.revealed.value && game.answered.value?.explanation"
            class="text-body-sm text-ink-2"
          >
            {{ game.answered.value.explanation }}
          </p>

          <div class="flex flex-wrap items-center justify-between gap-xs">
            <p class="text-caption text-ink-3">
              Keys: 1-{{ game.stageQuestion.value.answer_options.length || 4 }} to answer,
              Enter to continue, Esc to leave.
            </p>

            <!-- autoAdvance moves on by itself; this is for a reader who is done reading. -->
            <button
              v-if="game.revealed.value"
              class="btn-primary"
              type="button"
              @click="game.next()"
            >
              {{ game.isLast.value ? 'See the summary' : 'Next question' }}
            </button>
            <button v-else class="btn-ghost" type="button" @click="game.skip()">
              Skip this question
            </button>
          </div>
        </footer>
      </template>
    </div>
  </GameShell>
</template>

<style scoped>
.play-center {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.play-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.stage-count {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 15px;
}

.play-clock {
  font-size: 28px;
  font-weight: 600;
  color: var(--ink);
}

.play-clock.is-urgent {
  color: var(--ans-a);
}

.play-clock.is-late {
  font-size: 20px;
  color: var(--ans-c);
}

.late-note {
  padding: 8px 12px;
  border-radius: var(--r-md);
  background: var(--ans-c-soft);
  color: var(--ans-c);
  font-size: 13px;
  font-weight: 500;
}

.play-score {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 18px;
  font-weight: 600;
  color: var(--ink);
}

.play-main {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.stage-inner {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
}

.play-foot {
  display: grid;
  gap: 10px;
}

.track {
  height: 6px;
  overflow: hidden;
  border-radius: var(--r-full);
  background: var(--hairline);
}

.track-fill {
  height: 100%;
  border-radius: var(--r-full);
  background: var(--spotlight);
  transition: width var(--t-ui) linear;
}

.track-fill.is-urgent {
  background: var(--ans-a);
}

.verdict {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-radius: var(--r-lg);
  border: 1px solid var(--hairline);
  background: var(--canvas);
}

.verdict-mark {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: var(--r-full);
  background: var(--paper);
  font-size: 18px;
}

.verdict-text {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
}

.verdict-title {
  font-size: 17px;
  font-weight: 600;
}

.verdict-score {
  font-size: 15px;
}

.verdict-note {
  font-size: 13px;
  color: var(--ink-2);
}

.answer-key {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
  padding: 12px 16px;
  border-radius: var(--r-md);
  border: 1px solid var(--ans-d);
  background: var(--ans-d-soft);
}

.answer-key-text {
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--ink);
  word-break: break-word;
}

.verdict.is-correct {
  border-color: var(--ans-d);
  background: var(--ans-d-soft);
  color: var(--ans-d);
}

.verdict.is-wrong {
  border-color: var(--ans-a);
  background: var(--ans-a-soft);
  color: var(--ans-a);
}

.verdict.is-missed {
  color: var(--ink-2);
}

@media (prefers-reduced-motion: reduce) {
  .track-fill {
    transition: none;
  }
}
</style>
