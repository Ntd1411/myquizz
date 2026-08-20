import { computed, onScopeDispose, ref } from 'vue'
import {
  PREVIEW_CONFIG,
  PREVIEW_FALLBACK_SECONDS,
  computePreviewScore,
} from '@/utils/previewScoring'

/**
 * A single-player rehearsal of a classic match, played entirely in this tab.
 *
 * Nothing is created on the server: no room, no socket, no rows in game_sessions or
 * player_sessions, and play_count is left alone. That is the whole point of a preview -
 * an author trying their own quiz out should not leave a match behind, and a reader
 * curious about a public quiz should not need a code to look at it.
 *
 * The clock is therefore the local one. A live match reads `endsAt` from the server
 * precisely because several players share one deadline; a rehearsal has nobody to agree
 * with, so `time_limit` of the question drives a local deadline instead.
 *
 * Two rules are kept from a real match on purpose:
 *   - the answer key is not handed to the stage until the answer is in, so the preview
 *     plays like the quiz plays;
 *   - the reveal advances by itself after timing.showResultsSeconds, like classic does,
 *     so the rehearsal runs at the pace of the real thing. `next()` is still there for a
 *     reader who wants the explanation now rather than in two seconds.
 *
 * The deadline is real but not final: flow.allowAnswerLate is on, so zero on the clock
 * stops the speed bonus and taxes the answer by latePenaltyRatio instead of closing the
 * question. A room can close it because the host is there to move everyone on; here the
 * only person waiting is the one reading, and losing a question to a clock they were
 * still reading teaches them nothing about the quiz. `skip()` is the way out.
 *
 * @param {() => object|null} readQuiz getter for a quiz in the api/quiz.mapper shape
 */
const TICK_MS = 200
const CHOICE_TYPES = ['multiple_choice', 'multiple_select']

/** The server compares answers as trimmed lowercase strings, so the preview matches. */
function asKey(value) {
  return String(value ?? '').trim().toLowerCase()
}

function isChoice(question) {
  return CHOICE_TYPES.includes(question?.type)
}

/** time_limit is required by the API, but an imported row can still carry a 0. */
function limitOf(question) {
  const seconds = Number(question?.timeLimit)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : PREVIEW_FALLBACK_SECONDS
}

/** The answer key, in the shape QuestionStage and the review rows already read. */
function correctOf(question) {
  if (!question) return null
  if (isChoice(question)) {
    const indexes = question.correctIndexes ?? []
    // A choice question whose key never parsed into option indexes (an old row, or one
    // imported with the answer written out) would otherwise reveal nothing at all, so the
    // text is used as the key rather than showing a question with no answer.
    if (indexes.length) return indexes
    return question.correctText || []
  }
  return question.correctText || null
}

/**
 * QuestionStage speaks the snapshot shape a room broadcasts, so the mapped detail row is
 * translated once here instead of teaching the stage a second shape. An option is valued
 * by its position, because that is what `correct_answer` points at (api/quiz.mapper.js),
 * and that is what keeps a pick comparable to the key.
 */
function toStageQuestion(question, index, total) {
  if (!question) return null
  return {
    index,
    total,
    question_type: question.type,
    question_text: question.text,
    question_image: question.imageUrl,
    question_hint: question.hint,
    answer_options: (question.options ?? []).map((option) => ({
      id: option.index,
      option_text: option.text,
    })),
  }
}

export function usePreviewGame(readQuiz) {
  const quiz = computed(() => readQuiz())
  const questions = computed(() => quiz.value?.questions ?? [])
  const total = computed(() => questions.value.length)

  // idle -> countdown -> question -> results -> ... -> finished
  const phase = ref('idle')
  const index = ref(0)
  const score = ref(0)
  const streak = ref(0)

  // One row per finished question, in the order they were played. The field names are
  // the ones GET /games/:id/review answers with, so the same list component renders a
  // preview and a real match.
  const rows = ref([])

  // What is being built for the question on screen, and the graded row once it is in.
  const picks = ref([])
  const text = ref('')
  const answered = ref(null)

  const now = ref(Date.now())
  const openedAt = ref(null)
  const deadline = ref(null)
  const resultsEndsAt = ref(null)
  const countdownEndsAt = ref(null)
  const startedAt = ref(null)
  const finishedAt = ref(null)

  let ticker = null

  const question = computed(() => questions.value[index.value] ?? null)
  const timeLimit = computed(() => limitOf(question.value))

  function stopTicking() {
    if (!ticker) return
    clearInterval(ticker)
    ticker = null
  }

  // The composable can be torn down mid-question (the reader leaves the page), and an
  // interval left running would keep grading a question nobody is looking at.
  onScopeDispose(stopTicking)

  function startTicking() {
    if (ticker) return
    ticker = setInterval(() => {
      now.value = Date.now()
      tick()
    }, TICK_MS)
  }

  function tick() {
    if (phase.value === 'countdown' && countdownEndsAt.value !== null) {
      if (now.value >= countdownEndsAt.value) openQuestion(0)
      return
    }

    // With allowAnswerLate on, a spent clock only makes the answer late (see grade), so
    // the question stays open. Without it, running out of time closes the question
    // unanswered, exactly like a locked room question.
    if (phase.value === 'question' && deadline.value !== null && now.value >= deadline.value) {
      if (!PREVIEW_CONFIG.flow.allowAnswerLate) grade(null, { timedOut: true })
      return
    }

    if (phase.value === 'results' && resultsEndsAt.value !== null && now.value >= resultsEndsAt.value) {
      next()
    }
  }

  function openQuestion(at) {
    index.value = at
    picks.value = []
    text.value = ''
    answered.value = null
    resultsEndsAt.value = null
    openedAt.value = Date.now()
    deadline.value = openedAt.value + limitOf(questions.value[at]) * 1000
    phase.value = 'question'
  }

  function isAnswerCorrect(current, answer) {
    if (!isChoice(current)) {
      const want = asKey(current.correctText)
      return Boolean(want) && asKey(answer) === want
    }

    const want = (current.correctIndexes ?? []).map(asKey).sort()
    const got = (Array.isArray(answer) ? answer : [answer]).map(asKey).sort()
    if (!want.length || !got.length) return false

    // multiple_select is all or nothing, like the server grading it.
    if (current.type === 'multiple_select') {
      return got.length === want.length && got.every((value, at) => value === want[at])
    }
    return want.includes(got[0])
  }

  /**
   * Closes the question on screen: grades it, keeps the row for the summary and moves to
   * the reveal. `answer` is null for a skipped or timed-out question.
   */
  function grade(answer, { timedOut = false } = {}) {
    const current = question.value
    if (!current || phase.value !== 'question') return

    const limit = limitOf(current)
    const hasAnswer =
      !timedOut &&
      answer !== null &&
      answer !== undefined &&
      (Array.isArray(answer) ? answer.length > 0 : String(answer).trim() !== '')

    const at = Date.now()
    // The real time on the question, which can run past the limit now that a late answer
    // is accepted. Scoring clamps it, the way the server clamps it, but the row keeps the
    // honest number so the summary can show how long a question really took.
    const timeTaken = Math.round(Math.max(0, (at - (openedAt.value ?? at)) / 1000) * 100) / 100
    const isLate = hasAnswer && deadline.value !== null && at > deadline.value

    const isCorrect = hasAnswer && isAnswerCorrect(current, answer)
    // An unanswered question is never scored, so negative marking cannot punish a
    // deadline the reader never got to see.
    const earned = hasAnswer
      ? computePreviewScore(
        { isCorrect, timeTaken, timeLimit: limit, streak: streak.value, isLate },
        PREVIEW_CONFIG,
      )
      : 0

    score.value += earned
    streak.value = isCorrect ? streak.value + 1 : 0

    const row = {
      question_id: current.id ?? null,
      question_index: index.value,
      question_text: current.text,
      question_image: current.imageUrl,
      question_type: current.type,
      answer_options: (current.options ?? []).map((option) => ({
        id: option.index,
        option_text: option.text,
      })),
      explanation: current.explanation ?? '',
      your_answer: hasAnswer ? answer : null,
      correct_answer: correctOf(current),
      is_correct: isCorrect,
      score_earned: earned,
      time_taken: hasAnswer ? timeTaken : null,
      answered: hasAnswer,
      is_late: isLate,
    }

    rows.value = [...rows.value, row]
    answered.value = row
    deadline.value = null
    // The reveal is on a clock of its own when autoAdvance is on; tick() moves it along.
    // A question that was got right only needs long enough to see the tick, while a wrong
    // or missed one is the whole reason a preview exists: there is an answer to read and
    // usually an explanation under it, so that reveal is given twice the time.
    const revealSeconds = PREVIEW_CONFIG.timing.showResultsSeconds * (isCorrect ? 1 : 2)
    resultsEndsAt.value = PREVIEW_CONFIG.timing.autoAdvance
      ? at + revealSeconds * 1000
      : null
    phase.value = 'results'
  }

  function finish() {
    finishedAt.value = Date.now()
    deadline.value = null
    resultsEndsAt.value = null
    phase.value = 'finished'
    stopTicking()
  }

  /** Starts the countdown. Callers must check that the quiz has questions first. */
  function start() {
    if (!total.value) return

    index.value = 0
    score.value = 0
    streak.value = 0
    rows.value = []
    picks.value = []
    text.value = ''
    answered.value = null
    openedAt.value = null
    deadline.value = null
    resultsEndsAt.value = null
    finishedAt.value = null
    startedAt.value = Date.now()
    now.value = Date.now()
    countdownEndsAt.value = Date.now() + PREVIEW_CONFIG.timing.countdownSeconds * 1000
    phase.value = 'countdown'
    startTicking()
  }

  const canAnswer = computed(() => phase.value === 'question' && !answered.value)

  /** A single-choice tap is the answer; a multiple_select tap only stages a pick. */
  function pick(value) {
    if (!canAnswer.value) return

    if (question.value?.type !== 'multiple_select') {
      grade(value)
      return
    }

    const key = String(value)
    const at = picks.value.findIndex((entry) => String(entry) === key)
    if (at === -1) picks.value = [...picks.value, value]
    else picks.value = picks.value.filter((_, position) => position !== at)
  }

  /** Sends what has been built: the staged picks, or the typed answer. */
  function submit() {
    if (!canAnswer.value) return

    const current = question.value
    if (!isChoice(current)) {
      if (!text.value.trim()) return
      grade(text.value.trim())
      return
    }

    if (!picks.value.length) return
    grade(picks.value)
  }

  /** Gives up on the question on screen, which counts as unanswered. */
  function skip() {
    if (!canAnswer.value) return
    grade(null, { timedOut: true })
  }

  function next() {
    if (phase.value !== 'results') return
    if (index.value + 1 >= total.value) {
      finish()
      return
    }
    openQuestion(index.value + 1)
  }

  function stop() {
    stopTicking()
    resultsEndsAt.value = null
    phase.value = 'idle'
  }

  const revealed = computed(() => phase.value === 'results')

  const selected = computed(() => {
    const sent = answered.value?.your_answer
    if (sent === null || sent === undefined) return picks.value
    return Array.isArray(sent) ? sent : [sent]
  })

  const secondsLeft = computed(() => {
    if (phase.value === 'countdown' && countdownEndsAt.value !== null) {
      return Math.max(0, Math.ceil((countdownEndsAt.value - now.value) / 1000))
    }
    if (phase.value === 'question' && deadline.value !== null) {
      return Math.max(0, Math.ceil((deadline.value - now.value) / 1000))
    }
    return null
  })

  /**
   * The clock on the question on screen has run out, but the answer is still being taken
   * at the late rate. The screen says so, because a scoreboard that quietly pays less is
   * worse than one that explains itself.
   */
  const isLate = computed(
    () => phase.value === 'question' && deadline.value !== null && now.value > deadline.value,
  )

  // Share of the question clock still left, for the bar above the stage.
  const progress = computed(() => {
    if (phase.value !== 'question' || deadline.value === null) return 0
    const left = (deadline.value - now.value) / 1000
    return Math.min(1, Math.max(0, left / timeLimit.value))
  })

  const correctCount = computed(() => rows.value.filter((row) => row.is_correct).length)
  const answeredCount = computed(() => rows.value.filter((row) => row.answered).length)

  const accuracy = computed(() => {
    if (!total.value) return null
    return Math.round((correctCount.value / total.value) * 100)
  })

  const elapsedSeconds = computed(() => {
    if (startedAt.value === null) return null
    const end = finishedAt.value ?? now.value
    return Math.max(0, Math.round((end - startedAt.value) / 1000))
  })

  return {
    // state
    phase,
    index,
    total,
    question,
    stageQuestion: computed(() => toStageQuestion(question.value, index.value, total.value)),
    correctAnswer: computed(() => (revealed.value ? correctOf(question.value) : null)),
    selected,
    text,
    answered,
    rows,
    score,
    streak,
    revealed,
    canAnswer,
    isLate,
    secondsLeft,
    progress,
    timeLimit,
    correctCount,
    answeredCount,
    accuracy,
    elapsedSeconds,
    isLast: computed(() => index.value + 1 >= total.value),
    // actions
    start,
    pick,
    submit,
    skip,
    next,
    restart: start,
    stop,
  }
}
