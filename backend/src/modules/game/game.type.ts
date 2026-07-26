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
  answered_questions: AnsweredQuestion[]
  streak: number
  lives: number | null
  current_question_index: number
  status: string
}

export interface AuthSocket extends Socket {
  user?: User
}

export type LobbyPlayer = Pick<PlayerSessionRow, 'id' | 'player_name' | 'player_score' | 'status'>

export interface LeaderboardRow {
  id: number
  player_name: string
  player_score: number
  correct_answers_count: number
  streak: number
  status: string
}

export interface QuestionStatRow {
  question_id: number
  answer_count: number
  correct_count: number
}

export interface CachedAnswer {
  answer: unknown
  isCorrect: boolean
  timeTaken: number
  scoreEarned: number
}

// Question row as stored inside quiz_snapshots.snapshot_data.questions
export interface SnapshotQuestion {
  id: number
  quiz_id: number
  question_type: 'multiple_choice' | 'multiple_select' | 'short_answer' | 'long_answer'
  question_text: string
  question_image: string | null
  question_hint?: string | null
  explanation?: string | null
  time_limit: number
  answer_options: Array<{ id: number; option_text: string }> | null
  correct_answer: number[] | string // option id array, or text; server only, never sent to a client
}

// One entry of player_sessions.answered_questions
export interface AnsweredQuestion {
  question_id: number
  question_index: number
  answer: unknown
  is_correct: boolean
  is_late: boolean
  time_taken: number
  score_earned: number
  answered_at: string
}
