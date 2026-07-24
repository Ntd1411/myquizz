import type { GameConfig } from '../game.schemas.js'

export interface AnswerContext {
  isCorrect: boolean
  timeTaken: number
  timeLimit: number
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

export interface GameModeHandler {
  mode: string
  defaultConfig(): GameConfig
  validateConfig(cfg: GameConfig): void
  evaluateAnswer(ctx: AnswerContext, cfg: GameConfig): AnswerOutcome
  shouldAdvance(ctx: GameContext, cfg: GameConfig): boolean
  isGameOver(ctx: GameContext, cfg: GameConfig): boolean
}
