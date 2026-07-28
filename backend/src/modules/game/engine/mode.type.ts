import type { GameConfig } from '../game.schemas.js'
import type { ModeConfigSpec } from './config.rules.js'

export interface AnswerContext {
  isCorrect: boolean
  timeTaken: number
  // 0 means the question had no deadline at all -> no speed bonus
  timeLimit: number
  // true when the answer arrived after the deadline and flow.allowAnswerLate accepted it
  isLate: boolean
  player: { streak: number; lives: number | null }
}

export interface AnswerOutcome {
  scoreEarned: number
  newStreak: number
  livesRemaining?: number
  eliminated?: boolean
}

export interface GameContext {
  activePlayers: number
  // host-paced: the flags below are calculated for the ENTIRE ROOM.
  // self-paced (solo/practice/marathon): calculated per PLAYER
  // (whether this player has run out of questions / has answered).
  noMoreQuestions: boolean
  allAnswered: boolean
  timeUp: boolean
  matchTimeUp?: boolean
}

export type GameModeHandler = {
  mode: string
  configSpec: ModeConfigSpec
  defaultConfig: () => GameConfig
  evaluateAnswer: (ctx: AnswerContext, cfg: GameConfig) => AnswerOutcome
  shouldAdvance: (ctx: GameContext, cfg: GameConfig) => boolean
  isGameOver: (ctx: GameContext, cfg: GameConfig) => boolean
}
