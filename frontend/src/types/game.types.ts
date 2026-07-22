// Game types matching backend schemas

export type GameStatus = 'waiting' | 'active' | 'finished'

export interface CreateGameRequest {
  quiz_id: number
  session_name: string
}

export interface GameResponse {
  session_id: number
  session_code: string
  session_name: string
  quiz_title: string
  total_questions: number
  status: GameStatus
  host_player_session_id: number
}

export interface JoinGameRequest {
  player_name: string
  player_id?: number
}

export interface JoinGameResponse {
  player_session_id: number
  player_name: string
  is_host: boolean
  game_info: {
    session_id: number
    session_name: string
    total_questions: number
    total_players: number
    status: GameStatus
  }
}

export interface GameSession {
  id: number
  quiz_snapshot_id: number
  session_name: string
  session_code: string
  session_host: number
  total_players: number
  total_questions: number
  session_status: GameStatus
  created_at: string
  updated_at: string
}

export interface PlayerSession {
  id: number
  game_session_id: number
  player_id?: number
  player_name: string
  player_score: number
  is_host: boolean
  correct_answers_count: number
  created_at: string
  updated_at: string
}
