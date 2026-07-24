import type { GameConfig } from './game.schemas.js'
import type { Socket } from 'socket.io'
import type { User } from '../../shared/types/shared.types.js'

export interface GameSessionRow {
  id: number
  quiz_snapshot_id: number
  session_name: string
  session_code: string
  session_host: number
  total_players: number
  total_questions: number
  session_status: 'lobby' | 'active' | 'paused' | 'finished' | 'cancelled'
  game_mode: string
  config: GameConfig
  current_question_index: number
  current_phase: string
  phase_ends_at: string | null
  quiz_id?: number | null
}

export interface PlayerSessionRow {
  id: number
  game_session_id: number
  player_id: number | null
  player_guest_id: string | null
  player_name: string
  player_score: number
  correct_answers_count: number
  streak: number
  lives: number | null
  current_question_index: number
  status: string
}

export interface AuthSocket extends Socket {
  user?: User
}

export type LobbyPlayer = Pick<PlayerSessionRow, 'id' | 'player_name' | 'player_score' | 'status'>

export interface CachedAnswer {
  answer: unknown
  isCorrect: boolean
  timeTaken: number
  scoreEarned: number
}
