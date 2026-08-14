/**
 * Presentation layer for the game config contract.
 *
 * `GET /games/game-modes` describes every mode as `{ mode, pacing, scored, defaultConfig,
 * editable: { 'flow.lives': { kind, min, max, nullable, note, default } }, locked: { path: value } }`.
 * The form is rendered from that payload, so nothing here decides which control exists:
 * this file only holds the wording and the dotted-path helpers.
 */

// Modes the UI never offers. `team` exists in the backend but has no player UI yet.
export const HIDDEN_MODES = ['team']

export const MODE_META = {
  classic: { label: 'Classic', tagline: 'Everyone answers the same question, you control the pace.' },
  solo: { label: 'Solo', tagline: 'Each player runs through the quiz at their own pace.' },
  survival: { label: 'Survival', tagline: 'Wrong answers cost a life. Last one standing wins.' },
  marathon: { label: 'Marathon', tagline: 'Questions loop until the shared time budget runs out.' },
  practice: { label: 'Practice', tagline: 'No score, no ranking. Answers are always revealed.' },
}

export const GROUPS = [
  { key: 'lobby', label: 'Room' },
  { key: 'timing', label: 'Timing' },
  { key: 'flow', label: 'Flow' },
  { key: 'scoring', label: 'Scoring' },
]

/**
 * The settings a host actually changes when opening a room. Everything else a mode allows
 * stays editable, only behind the advanced block, so the setup screen fits on one page.
 */
export const COMMON_PATHS = [
  'lobby.maxPlayers',
  'lobby.allowGuests',
  'timing.perQuestionSeconds',
  'timing.totalMatchSeconds',
  'timing.autoAdvance',
  'flow.lives',
  'flow.showLeaderboard',
  'flow.shuffleQuestions',
]

/** Splits the paths a mode exposes into the everyday ones and the rest, in spec order. */
export function splitPaths(editable) {
  const all = Object.keys(editable ?? {})
  const common = COMMON_PATHS.filter((path) => all.includes(path))
  return { common, advanced: all.filter((path) => !common.includes(path)) }
}

export const FIELD_LABELS = {
  'lobby.maxPlayers': { label: 'Max players' },
  'lobby.allowLateJoin': { label: 'Allow joining after the start' },
  'lobby.allowGuests': { label: 'Allow guests', help: 'Off means players must sign in first.' },
  'timing.perQuestionSeconds': {
    label: 'Time per question',
    unit: 's',
    help: 'Empty uses the limit saved on each question, 0 removes the deadline.',
  },
  'timing.totalMatchSeconds': { label: 'Total match time', unit: 's' },
  'timing.autoAdvance': { label: 'Advance automatically', help: 'Off means the next question waits for a click.' },
  'timing.countdownSeconds': { label: 'Countdown before the first question', unit: 's' },
  'timing.showResultsSeconds': { label: 'Result screen', unit: 's' },
  'flow.pacing': { label: 'Pacing' },
  'flow.lives': { label: 'Lives' },
  'flow.showCorrectAnswer': { label: 'Reveal the correct answer' },
  'flow.showLeaderboard': { label: 'Leaderboard' },
  'flow.allowAnswerLate': { label: 'Accept late answers' },
  'flow.shuffleQuestions': { label: 'Shuffle questions' },
  'flow.shuffleOptions': { label: 'Shuffle answer options' },
  'flow.showHint': { label: 'Show hints' },
  'flow.reviewMode': { label: 'Let players review their answers', help: 'Always reveals the correct answer at the end.' },
  'scoring.speedBonus': { label: 'Speed bonus' },
  'scoring.negativeMarking': { label: 'Subtract points for wrong answers' },
  'scoring.basePoints': { label: 'Base points' },
  'scoring.latePenaltyRatio': { label: 'Late answer penalty' },
  'scoring.streak.enabled': { label: 'Streak bonus' },
  'scoring.streak.bonusPerStep': { label: 'Streak bonus per step' },
  'scoring.streak.max': { label: 'Streak cap' },
  version: { label: 'Config version' },
}

export const ENUM_LABELS = {
  never: 'Never',
  between_questions: 'Between questions',
  end_only: 'At the end only',
  host: 'Host paced',
  self: 'Self paced',
}

const IGNORED_REASONS = {
  locked: 'this mode owns that setting',
  unknown: 'that setting does not exist in this mode',
  invalid: 'the value is out of range',
}

export function modeLabel(mode) {
  return MODE_META[mode]?.label ?? mode
}

export function fieldLabel(path) {
  return FIELD_LABELS[path]?.label ?? path
}

export function enumLabel(value) {
  return ENUM_LABELS[value] ?? String(value)
}

/** Human wording for one entry of the server's `ignored` array. */
export function ignoredMessage(entry) {
  const reason = IGNORED_REASONS[entry?.reason] ?? 'the server refused it'
  return `${fieldLabel(entry?.path)}: ${reason}`
}

export function getPath(source, path) {
  return path.split('.').reduce((acc, key) => (acc === null || acc === undefined ? acc : acc[key]), source)
}

/** Turns { 'flow.lives': 3 } into { flow: { lives: 3 } } for the API body. */
export function buildPatch(values) {
  const out = {}
  for (const [path, value] of Object.entries(values)) {
    const keys = path.split('.')
    const last = keys.pop()
    let cursor = out
    for (const key of keys) {
      if (typeof cursor[key] !== 'object' || cursor[key] === null) cursor[key] = {}
      cursor = cursor[key]
    }
    cursor[last] = value
  }
  return out
}

/** Dotted map of the editable fields, read from a full config or from the spec default. */
export function readValues(editable, config) {
  const values = {}
  for (const [path, field] of Object.entries(editable ?? {})) {
    const current = config ? getPath(config, path) : undefined
    values[path] = current === undefined ? (field.default ?? null) : current
  }
  return values
}

/**
 * Only the fields that really differ are sent. The server normalizes a config after
 * every merge (marathon forces autoAdvance, practice drops scoring…), so echoing an
 * untouched value back would be reported as ignored and look like an error.
 */
export function changedValues(values, baseline) {
  return Object.fromEntries(Object.entries(values).filter(([path, value]) => value !== baseline?.[path]))
}
