<script setup>
import AnswerReviewList from '@/components/game/AnswerReviewList.vue'

/**
 * End screen of a preview run.
 *
 * It is the player end screen minus everything that needs a room: no standings, no rank,
 * no podium, because one person cannot be ranked. What is left is what an author came for
 * - how the quiz reads at speed, and which questions tripped the reader up.
 *
 * Every number here is an estimate and says so: the score is computed in the browser
 * from a copy of the classic rule (utils/previewScoring.js), not by the server.
 */
defineProps({
  rows: { type: Array, default: () => [] },
  score: { type: Number, default: 0 },
  correctCount: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  answeredCount: { type: Number, default: 0 },
  accuracy: { type: Number, default: null },
  elapsedSeconds: { type: Number, default: null },
  /** Only the owner is offered the way back into the editor. */
  canEdit: { type: Boolean, default: false },
  quizId: { type: [String, Number], default: null },
})

const emit = defineEmits(['restart', 'exit'])
</script>

<template>
  <section class="grid gap-lg">
    <div class="card-surface hero p-xl text-center">
      <p class="eyebrow-label">
        Preview finished
      </p>
      <div class="final-mark">
        &#10003;
      </div>
      <h2 class="mt-sm text-heading-2 text-ink">
        That is the whole quiz
      </h2>
      <p class="mt-xxs text-body-sm text-ink-2">
        Nothing was saved: no room was opened and no result was recorded.
      </p>

      <div class="stat-row">
        <div class="stat">
          <p class="stat-value num">
            {{ score }}
          </p>
          <p class="stat-label">
            Estimated score
          </p>
        </div>
        <div class="stat">
          <p class="stat-value num">
            {{ correctCount }}<span v-if="total" class="stat-total">/{{ total }}</span>
          </p>
          <p class="stat-label">
            Correct
          </p>
        </div>
        <div class="stat">
          <p class="stat-value num">
            {{ answeredCount }}<span v-if="total" class="stat-total">/{{ total }}</span>
          </p>
          <p class="stat-label">
            Answered
          </p>
        </div>
        <div v-if="accuracy !== null" class="stat">
          <p class="stat-value num">
            {{ accuracy }}%
          </p>
          <p class="stat-label">
            Accuracy
          </p>
        </div>
        <div v-if="elapsedSeconds !== null" class="stat">
          <p class="stat-value num">
            {{ elapsedSeconds }}s
          </p>
          <p class="stat-label">
            Time spent
          </p>
        </div>
      </div>

      <p class="mt-md text-caption text-ink-3">
        The score follows the classic rule, computed in this browser. A hosted game is
        scored by the server and can differ.
      </p>
    </div>

    <section class="card-surface p-lg">
      <p class="section-title">
        Your answers
      </p>
      <p class="mt-xxs text-caption text-ink-3">
        Every question of the quiz, wrong ones first, then the ones you skipped.
      </p>
      <AnswerReviewList class="mt-lg" :items="rows" />
    </section>

    <div class="flex flex-wrap items-center justify-center gap-xs">
      <button class="btn-primary" type="button" @click="emit('restart')">
        Play it again
      </button>
      <RouterLink
        v-if="canEdit && quizId"
        class="btn-utility"
        :to="{ name: 'edit-quiz', params: { id: String(quizId) } }"
      >
        Edit this quiz
      </RouterLink>
      <button class="btn-ghost" type="button" @click="emit('exit')">
        Leave the preview
      </button>
    </div>
  </section>
</template>

<style scoped>
.hero {
  background:
    radial-gradient(120% 140% at 50% -20%, var(--spotlight-soft) 0%, transparent 60%),
    var(--paper);
}

.final-mark {
  width: 64px;
  height: 64px;
  margin: var(--space-md, 16px) auto 0;
  display: grid;
  place-items: center;
  border-radius: var(--r-full);
  background: var(--spotlight-soft);
  color: var(--spotlight);
  font-size: 30px;
  line-height: 1;
}

.stat-row {
  margin-top: 22px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.stat {
  min-width: 110px;
  flex: 1 1 110px;
  max-width: 180px;
  padding: 12px 10px;
  border-radius: var(--r-lg);
  background: var(--canvas);
  border: 1px solid var(--hairline);
}

.stat-value {
  font-size: 26px;
  line-height: 1.1;
  color: var(--ink);
}

.stat-total {
  font-size: 15px;
  color: var(--ink-3);
}

.stat-label {
  margin-top: 2px;
  font-size: 12px;
  color: var(--ink-3);
}
</style>
