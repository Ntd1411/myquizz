import { AppError } from '../../../shared/errors/AppError.js'
import type { GameConfig } from '../game.schema.js'

// A field descriptor is both what the frontend needs to render the control and
// what the server uses to accept or ignore an incoming value
export type FieldSpec =
  | { kind: 'boolean' }
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'number'; min?: number; max?: number; nullable?: boolean; note?: string }

export type ModeConfigSpec = {
  pacing: 'host' | 'self'
  usesLives: boolean
  usesMatchBudget: boolean
  scored: boolean
  // dotted paths the host may change, with the accepted range
  editable: Record<string, FieldSpec>
  // dotted paths owned by the mode: incoming values are always ignored
  locked: readonly string[]
}

// Every field a host could ever tune; a mode narrows this set or locks a field
const ALL_EDITABLE: Record<string, FieldSpec> = {
  'timing.perQuestionSeconds': {
    kind: 'number', min: 0, max: 600, nullable: true,
    note: 'null = use question time limit, 0 = no time limit'
  },
  'timing.autoAdvance': { kind: 'boolean' },
  'timing.totalMatchSeconds': { kind: 'number', min: 30, max: 7200, nullable: true },
  'lobby.maxPlayers': { kind: 'number', min: 1, max: 500 },
  'lobby.allowLateJoin': { kind: 'boolean' },
  'lobby.allowGuests': { kind: 'boolean' },
  'flow.showCorrectAnswer': { kind: 'boolean' },
  'flow.showLeaderboard': { kind: 'enum', values: ['never', 'between_questions', 'end_only'] },
  'flow.lives': { kind: 'number', min: 1, max: 10, nullable: true },
  'flow.allowAnswerLate': { kind: 'boolean' },
  'flow.shuffleQuestions': { kind: 'boolean' },
  'flow.shuffleOptions': { kind: 'boolean' },
  'flow.showHint': { kind: 'boolean' },
  'flow.reviewMode': { kind: 'boolean' },
  'scoring.speedBonus': { kind: 'boolean' },
  'scoring.negativeMarking': { kind: 'boolean' }
}

const pick = (...paths: string[]): Record<string, FieldSpec> =>
  Object.fromEntries(
    paths
      .map((path): [string, FieldSpec | undefined] => [path, ALL_EDITABLE[path]])
      .filter((entry): entry is [string, FieldSpec] => entry[1] !== undefined)
  )

const except = (...paths: string[]): Record<string, FieldSpec> =>
  Object.fromEntries(Object.entries(ALL_EDITABLE).filter(([path]) => !paths.includes(path)))

// pacing and the config version are never negotiable, in any mode
const ALWAYS_LOCKED = ['version', 'flow.pacing', 'flow.allowAnswerLate', 'timing.countdownSeconds', 'timing.showResultsSeconds',
  'scoring.basePoints', 'scoring.latePenaltyRatio', 'scoring.streak.enabled', 'scoring.streak.bonusPerStep',
  'scoring.streak.max'
]

// Anything not listed in editable is implicitly ignored; locked is the explicit
// list the frontend renders as read-only with the mode value next to it
export const MODE_CONFIG_SPEC: Record<string, ModeConfigSpec> = {
  classic: {
    pacing: 'host', usesLives: false, usesMatchBudget: false, scored: true,
    editable: except('flow.lives', 'timing.totalMatchSeconds'),
    locked: [...ALWAYS_LOCKED, 'flow.lives', 'timing.totalMatchSeconds']
  },
  survival: {
    // self-paced: each player fights independently until lives run out or questions end
    pacing: 'self', usesLives: true, usesMatchBudget: false, scored: true,
    editable: {
      ...except('scoring.negativeMarking', 'timing.totalMatchSeconds', 'timing.autoAdvance'),
      // survival needs a real number of lives, so null is not acceptable here
      'flow.lives': { kind: 'number', min: 1, max: 10 },
      'flow.showLeaderboard': { kind: 'enum', values: ['never', 'end_only'] }
    },
    locked: [...ALWAYS_LOCKED, 'scoring.negativeMarking', 'timing.totalMatchSeconds', 'timing.autoAdvance']
  },
  solo: {
    pacing: 'self', usesLives: false, usesMatchBudget: false, scored: true,
    editable: {
      ...except('flow.lives', 'timing.totalMatchSeconds'),
      // a self-paced player is never between the same two questions as anyone else
      'flow.showLeaderboard': { kind: 'enum', values: ['never', 'end_only'] }
    },
    locked: [...ALWAYS_LOCKED, 'flow.lives', 'timing.totalMatchSeconds']
  },
  marathon: {
    pacing: 'self', usesLives: true, usesMatchBudget: true, scored: true,
    editable: {
      ...except('timing.autoAdvance'),
      'flow.showLeaderboard': { kind: 'enum', values: ['never', 'end_only'] },
      'timing.totalMatchSeconds': { kind: 'number', min: 30, max: 7200 }
    },
    locked: [...ALWAYS_LOCKED, 'timing.autoAdvance']
  },
  practice: {
    pacing: 'self', usesLives: false, usesMatchBudget: false, scored: false,
    // no score, no deadline, no ranking: only the study helpers stay editable
    editable: pick(
      'flow.shuffleQuestions', 'flow.shuffleOptions', 'flow.showHint',
      'flow.reviewMode', 'lobby.maxPlayers', 'lobby.allowGuests'
    ),
    locked: [
      ...ALWAYS_LOCKED, 'flow.lives', 'flow.showCorrectAnswer',
      'flow.showLeaderboard', 'timing.autoAdvance', 'timing.perQuestionSeconds',
      'timing.totalMatchSeconds', 'scoring.speedBonus', 'scoring.negativeMarking'
    ]
  }
}

export const getConfigSpec = (mode: string): ModeConfigSpec => {
  const spec = MODE_CONFIG_SPEC[mode]
  if (!spec) throw new AppError(400, `Unsupported mode: ${mode}`)
  return spec
}

const getPath = (source: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, key) => (acc as Record<string, unknown> | null)?.[key], source)

const setPath = (target: Record<string, unknown>, path: string, value: unknown): void => {
  const keys = path.split('.')
  const last = keys.pop() as string
  let cursor = target
  for (const key of keys) {
    if (typeof cursor[key] !== 'object' || cursor[key] === null) cursor[key] = {}
    cursor = cursor[key] as Record<string, unknown>
  }
  cursor[last] = value
}

// Turn { flow: { lives: 3 } } into [['flow.lives', 3]] so one flat rule table can
// decide about every field, no matter how deep it sits
const flatten = (value: unknown, prefix = ''): Array<[string, unknown]> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [[prefix, value]]
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key)
  )
}

const accepts = (spec: FieldSpec, value: unknown): boolean => {
  if (spec.kind === 'boolean') return typeof value === 'boolean'
  if (spec.kind === 'enum') return typeof value === 'string' && spec.values.includes(value)
  if (value === null) return spec.nullable === true
  if (typeof value !== 'number' || !Number.isFinite(value)) return false
  if (spec.min !== undefined && value < spec.min) return false
  if (spec.max !== undefined && value > spec.max) return false
  return true
}

export type IgnoredField = {
  path: string
  value: unknown
  reason: 'unknown' | 'locked' | 'invalid'
}

// Never throws: an unknown, locked or out-of-range field is dropped and reported,
// so a stale or hostile client can only fail to change something
export const sanitizeConfigPatch = (
  mode: string,
  patch: unknown
): { patch: Record<string, unknown>; ignored: IgnoredField[] } => {
  const spec = getConfigSpec(mode)
  const clean: Record<string, unknown> = {}
  const ignored: IgnoredField[] = []
  if (patch === null || typeof patch !== 'object') return { patch: clean, ignored }

  for (const [path, value] of flatten(patch)) {
    if (value === undefined) continue
    if (spec.locked.includes(path)) {
      ignored.push({ path, value, reason: 'locked' })
      continue
    }
    const field = spec.editable[path]
    if (!field) {
      // covers typos like flow.shuffeQuestions and fields another mode owns
      ignored.push({ path, value, reason: 'unknown' })
      continue
    }
    if (!accepts(field, value)) {
      ignored.push({ path, value, reason: 'invalid' })
      continue
    }
    setPath(clean, path, value)
  }
  return { patch: clean, ignored }
}

// The payload the frontend needs: which controls to render, their range, the
// current value, and which fields to show as read-only
export const describeModeConfig = (mode: string, defaults: GameConfig) => {
  const spec = getConfigSpec(mode)
  return {
    mode,
    pacing: spec.pacing,
    scored: spec.scored,
    defaultConfig: defaults,
    editable: Object.fromEntries(
      Object.entries(spec.editable).map(([path, field]) => [
        path,
        { ...field, default: getPath(defaults, path) }
      ])
    ),
    locked: Object.fromEntries(spec.locked.map((path) => [path, getPath(defaults, path)]))
  }
}

// Runs after every merge: rewrite what the mode owns, so even an old config row
// or a field that slipped through can never leave the engine half configured
export const normalizeConfig = (cfg: GameConfig, mode: string): GameConfig => {
  const spec = getConfigSpec(mode)
  const out = JSON.parse(JSON.stringify(cfg)) as GameConfig
  const noDeadline = out.timing.perQuestionSeconds === 0

  out.flow.pacing = spec.pacing
  if (!spec.usesLives) out.flow.lives = null
  if (!spec.usesMatchBudget) out.timing.totalMatchSeconds = null
  // marathon loops questions against a time budget: it must always auto-advance
  // solo and survival (self-paced) let the host choose, so they are not forced here
  if (mode === 'marathon') out.timing.autoAdvance = true
  // late answering needs a player-owned clock and a hard deadline to be late against;
  // it also makes no sense when the server auto-advances as soon as the answer arrives.
  // When autoAdvance is false in self-paced mode with a deadline, allowAnswerLate is automatically enabled.
  if (spec.pacing !== 'self' || noDeadline || out.timing.autoAdvance) {
    out.flow.allowAnswerLate = false
  } else if (spec.pacing === 'self' && !out.timing.autoAdvance && !noDeadline) {
    out.flow.allowAnswerLate = true
  }
  if (noDeadline) out.scoring.speedBonus = false
  if (spec.pacing === 'self' && out.flow.showLeaderboard === 'between_questions')
    out.flow.showLeaderboard = 'end_only'
  // reviewing answers is pointless without the answer key
  if (out.flow.reviewMode) out.flow.showCorrectAnswer = true
  // marathon: fast feedback loop — lock the result window and always reveal the answer
  if (mode === 'marathon') {
    out.timing.showResultsSeconds = 2
    out.flow.showCorrectAnswer = true
  }
  if (!spec.scored) {
    out.scoring.basePoints = 0
    out.scoring.speedBonus = false
    out.scoring.streak.enabled = false
    out.scoring.negativeMarking = false
  }
  return out
}
