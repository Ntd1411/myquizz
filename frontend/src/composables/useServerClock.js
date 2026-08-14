import { computed, onScopeDispose, ref, unref } from 'vue'

/**
 * Every deadline the server sends (`endsAt`, `matchEndsAt`, `startsAt`) is an absolute
 * ISO timestamp on the server clock. The only thing the client needs is the offset
 * between that clock and the local one, so a reconnect refreshes the offset but never
 * restarts a question timer: the deadline itself does not move.
 */
const offsetMs = ref(0)
const nowMs = ref(Date.now())

const TICK_MS = 200

let tickHandle = null
let tickers = 0

function startTicking() {
  tickers += 1
  if (tickHandle) return
  tickHandle = setInterval(() => {
    nowMs.value = Date.now()
  }, TICK_MS)
}

function stopTicking() {
  tickers = Math.max(0, tickers - 1)
  if (tickers > 0 || !tickHandle) return
  clearInterval(tickHandle)
  tickHandle = null
}

/** Feeds the `serverTime` field carried by every game event into the offset. */
export function syncServerClock(serverTime) {
  if (!serverTime) return offsetMs.value
  const parsed = Date.parse(serverTime)
  if (Number.isNaN(parsed)) return offsetMs.value
  const local = Date.now()
  offsetMs.value = parsed - local
  nowMs.value = local
  return offsetMs.value
}

export function serverNow() {
  return Date.now() + offsetMs.value
}

export function remainingMs(endsAt) {
  if (!endsAt) return null
  const deadline = Date.parse(endsAt)
  if (Number.isNaN(deadline)) return null
  return Math.max(0, deadline - serverNow())
}

/** Whole seconds left before a deadline, or null when there is no deadline. */
export function remaining(endsAt) {
  const left = remainingMs(endsAt)
  return left === null ? null : Math.ceil(left / 1000)
}

/**
 * @param {object} [options]
 * @param {boolean} [options.tick] keep a shared interval alive so the reactive
 *   helpers below refresh on their own. Pass false for one-off reads.
 */
export function useServerClock({ tick = true } = {}) {
  if (tick) {
    startTicking()
    onScopeDispose(stopTicking)
  }

  return {
    offsetMs,
    nowMs,
    sync: syncServerClock,
    serverNow,
    remaining,
    remainingMs,
  }
}

/**
 * Reactive countdown for a deadline that may change (next question, pause, resume).
 * `source` can be a ref, a getter or a plain ISO string.
 */
export function useCountdown(source, { totalSeconds } = {}) {
  const clock = useServerClock()

  const deadlineMs = computed(() => {
    const endsAt = typeof source === 'function' ? source() : unref(source)
    if (!endsAt) return null
    const parsed = Date.parse(endsAt)
    return Number.isNaN(parsed) ? null : parsed
  })

  const msLeft = computed(() => {
    if (deadlineMs.value === null) return null
    return Math.max(0, deadlineMs.value - (clock.nowMs.value + clock.offsetMs.value))
  })

  const secondsLeft = computed(() =>
    msLeft.value === null ? null : Math.ceil(msLeft.value / 1000),
  )

  const expired = computed(() => msLeft.value !== null && msLeft.value <= 0)

  // 1 -> full time left, 0 -> deadline reached. Null when the question has no limit,
  // so a progress ring can hide itself instead of drawing a wrong arc.
  const progress = computed(() => {
    const total = unref(totalSeconds)
    if (!total || msLeft.value === null) return null
    return Math.min(1, Math.max(0, msLeft.value / (total * 1000)))
  })

  return { ...clock, deadlineMs, msLeft, secondsLeft, expired, progress }
}
