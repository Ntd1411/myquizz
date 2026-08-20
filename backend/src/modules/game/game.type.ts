import type { User } from '../auth/auth.type.js'
import type { GameConfig } from './game.schema.js'
import type { Socket } from 'socket.io'

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
  // Only selected by the history lookup, which has to tell "never existed" (404)
  // from "was deleted" (410) instead of filtering deleted rows away.
  deleted_at?: string | null
}

export interface PlayerSessionRow {
  id: number
  game_session_id: number
  player_id: number | null
  player_guest_id: string | null
  player_avatar?: string | null
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
  // Position the question had in the match, so a report never has to guess
  // "Question N" from the position of the row in the array
  question_index: number
  answer_count: number
  correct_count: number
}

/**
 * Who is reading a history list or a past match.
 *
 * A signed-in reader is identified by their account; a guest only by the UUID in
 * their browser. Exactly one of the two is ever set: the cookie wins, so pasting
 * someone else's guest id into the header while signed in reads nothing.
 */
export interface HistoryViewer {
  userId: number | null
  guestId: string | null
}

/** One row of GET /games/history. */
export interface HistoryEntry {
  id: number
  session_name: string
  game_mode: string
  session_status: string
  total_players: number
  total_questions: number
  // Moment the room closed, or when it was created if it was cancelled first.
  ended_at: string
  // Quiz identity as it was when the room was created: the snapshot is immutable,
  // so a renamed or deleted quiz still shows the name that was played.
  quiz_id: number | null
  quiz_name: string | null
  quiz_image: string | null
  host_name: string | null
  host_avatar: string | null
  // The viewer's own result, on the played tab only; null on the hosted tab.
  player_score: number | null
  correct_answers_count: number | null
  rank: number | null
}

/** One page of the history list. total only appears when include_total asked for it. */
export interface HistoryPage {
  items: HistoryEntry[]
  nextCursor: string | null
  hasMore: boolean
  total?: number
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
