import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { syncServerClock } from '@/composables/useServerClock'

/**
 * Mirror of the `/game` namespace state.
 *
 * The server is the only authority here: every field below is written from a socket
 * payload, never guessed locally. `game:state` (the reconnect snapshot) is the widest
 * payload, so its shape defines the store:
 *   session_status, current_phase, mode, config, index, total_questions, question,
 *   countdown, endsAt, matchEndsAt, remainingSeconds, player, leaderboard
 *
 * Everything that could reveal a correct answer while a question is still open lives
 * in a separate field the player screens simply do not read (hostQuestion, results).
 */
export const useGameStore = defineStore('game', () => {
  // connection
  const connection = ref('idle') // idle | connecting | connected | reconnecting | closed
  const lastError = ref(null) // { code, message }

  // identity, all of it comes from the REST join / host-token calls
  const role = ref(null) // 'player' | 'host'
  const code = ref(null)
  const sessionId = ref(null)
  const playerId = ref(null)

  // session state
  const sessionStatus = ref('lobby') // lobby | active | paused | finished | cancelled
  const currentPhase = ref(null) // countdown | question_active | question_locked | showing_results | finished
  const mode = ref(null)
  const config = ref(null)
  const totalQuestions = ref(0)

  // current question, always the public shape: correct_answer is never in here
  const index = ref(0)
  const question = ref(null)
  const timeLimit = ref(null)
  const endsAt = ref(null)
  const matchEndsAt = ref(null)
  const allowAnswerLate = ref(false)
  const countdownStartsAt = ref(null)

  // player state
  const player = ref(null)
  const lives = ref(null)
  const answers = ref({}) // question_index -> { answer, pending, isCorrect, scoreEarned }

  // roster and standings
  const players = ref([])
  const leaderboard = ref([]) // players: rank, id, player_name, player_score
  const hostLeaderboard = ref([]) // host only: answered / correct / wrong / streak / lives
  const answeredCount = ref(0)
  const activePlayers = ref(0)

  // reveal channels, only populated once the server decides to reveal
  const hostQuestion = ref(null) // host room only, carries correct_answer
  const results = ref(null) // question:results
  const lockedReason = ref(null)
  const awaitingNext = ref(null) // question:awaiting_next, self-paced with autoAdvance=false
  const finalResults = ref(null) // game:ended
  const review = ref(null) // GET /games/:id/review

  const isHost = computed(() => role.value === 'host')
  const isSelfPaced = computed(() => config.value?.flow?.pacing === 'self')
  const isHostPaced = computed(() => config.value?.flow?.pacing === 'host')
  const inLobby = computed(() => sessionStatus.value === 'lobby')
  const isActive = computed(() => sessionStatus.value === 'active')
  const isPaused = computed(() => sessionStatus.value === 'paused')
  const isFinished = computed(() => sessionStatus.value === 'finished')
  const autoAdvance = computed(() => config.value?.timing?.autoAdvance !== false)
  const connectedPlayers = computed(() => players.value.filter((p) => p.status === 'connected'))

  const currentAnswer = computed(() => answers.value[index.value] ?? null)
  const hasAnswered = computed(() => currentAnswer.value !== null)

  /**
   * A question is answerable while it is open. The server still has the last word:
   * it rejects a late or duplicate answer, this only keeps the UI honest.
   */
  const canAnswer = computed(() => {
    if (role.value !== 'player' || !question.value) return false
    if (sessionStatus.value !== 'active') return false
    if (hasAnswered.value) return false
    if (isSelfPaced.value) return true
    return currentPhase.value === 'question_active'
  })

  function setConnection(next, error = null) {
    connection.value = next
    if (error) lastError.value = error
    if (next === 'connected') lastError.value = null
  }

  function setError(error) {
    lastError.value = error
  }

  function setIdentity({ role: nextRole, code: nextCode, sessionId: nextId, playerId: nextPlayer } = {}) {
    if (nextRole) role.value = nextRole
    if (nextCode) code.value = nextCode
    if (nextId) sessionId.value = nextId
    if (nextPlayer) playerId.value = nextPlayer
  }

  // Every payload carries serverTime, so the clock offset is refreshed for free.
  function touchClock(payload) {
    if (payload?.serverTime) syncServerClock(payload.serverTime)
  }

  /** Rebuilds the answered map from the player row so a reload keeps the UI locked. */
  function readAnswers(row) {
    const map = {}
    for (const entry of row?.answered_questions ?? []) {
      map[entry.question_index] = {
        answer: entry.answer,
        pending: false,
        isCorrect: entry.is_correct ?? null,
        scoreEarned: entry.score_earned ?? null,
        isLate: entry.is_late ?? false,
      }
    }
    return map
  }

  /** `game:state`: the full snapshot, used on join, on reconnect and on pause/resume. */
  function applyState(payload) {
    if (!payload) return
    touchClock(payload)
    sessionStatus.value = payload.session_status ?? sessionStatus.value
    currentPhase.value = payload.current_phase ?? null
    mode.value = payload.mode ?? mode.value
    config.value = payload.config ?? config.value
    totalQuestions.value = payload.total_questions ?? totalQuestions.value
    index.value = payload.index ?? 0
    question.value = payload.question ?? null
    endsAt.value = payload.endsAt ?? null
    matchEndsAt.value = payload.matchEndsAt ?? null
    allowAnswerLate.value = Boolean(payload.allow_answer_late)
    countdownStartsAt.value = payload.countdown?.startsAt ?? null
    leaderboard.value = payload.leaderboard ?? []

    if (payload.player) {
      player.value = payload.player
      playerId.value = payload.player.id ?? playerId.value
      lives.value = payload.player.lives ?? null
      answers.value = readAnswers(payload.player)
    }
  }

  /** `lobby:updated` */
  function applyLobby(payload) {
    if (!payload) return
    touchClock(payload)
    sessionStatus.value = payload.session_status ?? sessionStatus.value
    config.value = payload.config ?? config.value
    players.value = payload.players ?? []
  }

  /** `game:started` */
  function applyStarted(payload) {
    touchClock(payload)
    sessionStatus.value = 'active'
    mode.value = payload?.mode ?? mode.value
    config.value = payload?.config ?? config.value
    totalQuestions.value = payload?.total_questions ?? totalQuestions.value
    results.value = null
    finalResults.value = null
    review.value = null
    answers.value = {}
  }

  /** `game:countdown` */
  function applyCountdown(payload) {
    touchClock(payload)
    sessionStatus.value = 'active'
    currentPhase.value = 'countdown'
    countdownStartsAt.value = payload?.startsAt ?? null
    question.value = null
  }

  /** `question:started`, host-paced (room wide) and self-paced (per player) */
  function applyQuestion(payload) {
    if (!payload?.question) return
    touchClock(payload)
    sessionStatus.value = 'active'
    currentPhase.value = 'question_active'
    question.value = payload.question
    index.value = payload.question.index ?? index.value
    totalQuestions.value = payload.question.total ?? totalQuestions.value
    timeLimit.value = payload.time_limit ?? null
    endsAt.value = payload.endsAt ?? null
    countdownStartsAt.value = null
    results.value = null
    lockedReason.value = null
    awaitingNext.value = null
    if (payload.matchEndsAt !== undefined) matchEndsAt.value = payload.matchEndsAt
    if (payload.allow_answer_late !== undefined) allowAnswerLate.value = Boolean(payload.allow_answer_late)
    if (payload.lives !== undefined) lives.value = payload.lives
  }

  /** `host:question`, host room only: this payload carries the answer key. */
  function applyHostQuestion(payload) {
    if (!payload?.question) return
    touchClock(payload)
    hostQuestion.value = payload
    index.value = payload.question.index ?? index.value
    totalQuestions.value = payload.total_questions ?? totalQuestions.value
    timeLimit.value = payload.time_limit ?? null
    endsAt.value = payload.endsAt ?? null
    answeredCount.value = 0
  }

  /** `question:locked` */
  function applyLocked(payload) {
    touchClock(payload)
    currentPhase.value = 'question_locked'
    lockedReason.value = payload?.reason ?? null
    endsAt.value = null
  }

  /** `question:results`: the first moment the correct answer may be shown. */
  function applyResults(payload) {
    touchClock(payload)
    currentPhase.value = 'showing_results'
    results.value = payload ?? null
    endsAt.value = payload?.nextQuestionAt ?? null
  }

  /** `leaderboard:updated` (players) */
  function applyLeaderboard(payload) {
    touchClock(payload)
    leaderboard.value = payload?.leaderboard ?? []
  }

  /** `leaderboard:host` (host room only) */
  function applyHostLeaderboard(payload) {
    touchClock(payload)
    hostLeaderboard.value = payload?.leaderboard ?? []
    totalQuestions.value = payload?.total_questions ?? totalQuestions.value
  }

  /** `answer:received` (players) and `host:answer-received` (host) */
  function applyAnswerReceived(payload) {
    touchClock(payload)
    if (payload?.index !== undefined && payload.index !== index.value) return
    answeredCount.value = payload?.answered ?? answeredCount.value
    activePlayers.value = payload?.activePlayers ?? activePlayers.value
  }

  /** `host:player-progress`, self-paced monitoring */
  function applyPlayerProgress(payload) {
    touchClock(payload)
    const row = payload?.player
    if (!row) return
    const next = players.value.slice()
    const at = next.findIndex((p) => p.id === row.id)
    if (at === -1) next.push(row)
    else next[at] = { ...next[at], ...row }
    players.value = next
    totalQuestions.value = payload.total_questions ?? totalQuestions.value
  }

  /** `question:awaiting_next`, self-paced with autoAdvance=false */
  function applyAwaitingNext(payload) {
    touchClock(payload)
    awaitingNext.value = payload ?? null
    if (payload?.lives !== undefined) lives.value = payload.lives
    // A reconnect learns the running total here: the answer ack that carried it is gone.
    if (payload?.player_score !== undefined)
      player.value = { ...(player.value ?? {}), player_score: payload.player_score }
    const previous = payload?.previous_result
    if (!previous) return
    answers.value = {
      ...answers.value,
      [previous.question_index]: {
        ...(answers.value[previous.question_index] ?? {}),
        pending: false,
        isCorrect: previous.is_correct ?? null,
        scoreEarned: previous.score_earned ?? null,
      },
    }
  }

  /** `question:timeout`, self-paced: the server closed the question unanswered. */
  function applyTimeout(payload) {
    touchClock(payload)
    if (payload?.lives !== undefined) lives.value = payload.lives
    results.value = payload ?? null
    answers.value = {
      ...answers.value,
      [payload?.index ?? index.value]: {
        answer: null,
        pending: false,
        isCorrect: false,
        scoreEarned: 0,
        timedOut: true,
      },
    }
  }

  /** `player:eliminated` */
  function applyEliminated(payload) {
    touchClock(payload)
    const next = players.value.map((p) => (p.id === payload?.id ? { ...p, status: 'eliminated' } : p))
    players.value = next
    if (payload?.id && payload.id === playerId.value) lives.value = 0
  }

  /** `player:finished`: one player is done, the match may still be running. */
  function applyPlayerFinished(payload) {
    touchClock(payload)
    const row = payload?.player
    if (!row) return
    if (row.id === playerId.value) {
      player.value = { ...(player.value ?? {}), ...row }
      currentPhase.value = 'finished'
      question.value = null
      awaitingNext.value = null
      if (payload.leaderboard) leaderboard.value = payload.leaderboard
      return
    }
    players.value = players.value.map((p) => (p.id === row.id ? { ...p, ...row } : p))
  }

  /** `game:ended` */
  function applyEnded(payload) {
    touchClock(payload)
    sessionStatus.value = 'finished'
    currentPhase.value = 'finished'
    question.value = null
    hostQuestion.value = null
    endsAt.value = null
    awaitingNext.value = null
    finalResults.value = payload ?? null
    if (payload?.leaderboard) leaderboard.value = payload.leaderboard
  }

  /** Answer sheet from `GET /games/:id/review`, asked for by the end screen. */
  function applyReview(payload) {
    touchClock(payload)
    review.value = payload ?? null
  }

  /** Optimistic lock right after `question:answer` is emitted. */
  function markAnswerPending(answer) {
    answers.value = {
      ...answers.value,
      [index.value]: { answer, pending: true, isCorrect: null, scoreEarned: null },
    }
  }

  /**
   * Ack of `question:answer`. Host-paced only acks `{ accepted: true }`: the outcome
   * arrives later with question:results, so nothing is revealed here.
   */
  function applyAnswerAck(ack) {
    touchClock(ack)
    const at = index.value
    const current = answers.value[at] ?? {}
    answers.value = {
      ...answers.value,
      [at]: {
        ...current,
        pending: false,
        isLate: ack?.isLate ?? false,
        isCorrect: ack?.isCorrect ?? current.isCorrect ?? null,
        scoreEarned: ack?.scoreEarned ?? current.scoreEarned ?? null,
        correctAnswer: ack?.correct_answer ?? null,
      },
    }
    if (ack?.lives !== undefined) lives.value = ack.lives
    if (ack?.totalScore !== undefined) player.value = { ...(player.value ?? {}), player_score: ack.totalScore }
  }

  /** Drops the optimistic lock when the server refused the answer. */
  function rejectAnswer() {
    const next = { ...answers.value }
    delete next[index.value]
    answers.value = next
  }

  function reset() {
    connection.value = 'idle'
    lastError.value = null
    role.value = null
    code.value = null
    sessionId.value = null
    playerId.value = null
    sessionStatus.value = 'lobby'
    currentPhase.value = null
    mode.value = null
    config.value = null
    totalQuestions.value = 0
    index.value = 0
    question.value = null
    timeLimit.value = null
    endsAt.value = null
    matchEndsAt.value = null
    allowAnswerLate.value = false
    countdownStartsAt.value = null
    player.value = null
    lives.value = null
    answers.value = {}
    players.value = []
    leaderboard.value = []
    hostLeaderboard.value = []
    answeredCount.value = 0
    activePlayers.value = 0
    hostQuestion.value = null
    results.value = null
    lockedReason.value = null
    awaitingNext.value = null
    finalResults.value = null
    review.value = null
  }

  return {
    connection,
    lastError,
    role,
    code,
    sessionId,
    playerId,
    sessionStatus,
    currentPhase,
    mode,
    config,
    totalQuestions,
    index,
    question,
    timeLimit,
    endsAt,
    matchEndsAt,
    allowAnswerLate,
    countdownStartsAt,
    player,
    lives,
    answers,
    players,
    leaderboard,
    hostLeaderboard,
    answeredCount,
    activePlayers,
    hostQuestion,
    results,
    lockedReason,
    awaitingNext,
    finalResults,
    review,
    isHost,
    isSelfPaced,
    isHostPaced,
    inLobby,
    isActive,
    isPaused,
    isFinished,
    autoAdvance,
    connectedPlayers,
    currentAnswer,
    hasAnswered,
    canAnswer,
    setConnection,
    setError,
    setIdentity,
    applyState,
    applyLobby,
    applyStarted,
    applyCountdown,
    applyQuestion,
    applyHostQuestion,
    applyLocked,
    applyResults,
    applyLeaderboard,
    applyHostLeaderboard,
    applyAnswerReceived,
    applyPlayerProgress,
    applyAwaitingNext,
    applyTimeout,
    applyEliminated,
    applyPlayerFinished,
    applyEnded,
    applyReview,
    markAnswerPending,
    applyAnswerAck,
    rejectAnswer,
    reset,
  }
})
