export interface User {
  id: number
  email: string
  fullname: string
  phone?: string
  avatar?: string
  description?: string
  created_at: string
}

export interface Quiz {
  id: number
  title: string
  description?: string
  thumbnail?: string
  category?: string
  language?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  time_limit?: number
  is_public: boolean
  created_by: number
  created_at: string
  updated_at: string
  questions?: Question[]
}

export interface Question {
  id?: number
  question_text: string
  question_type: 'multiple_choice' | 'true_false' | 'short_answer'
  options?: string[]
  correct_answer: string | string[]
  points: number
  time_limit?: number
  explanation?: string
  order_index: number
}

export interface GameSession {
  id: number
  quiz_id: number
  session_code: string
  host_id: number
  status: 'waiting' | 'in_progress' | 'finished'
  current_question: number
  created_at: string
  started_at?: string
  finished_at?: string
}

export interface PlayerSession {
  id: number
  session_id: number
  player_id?: number
  player_name: string
  score: number
  joined_at: string
  is_connected: boolean
}

export interface LeaderboardEntry {
  player_name: string
  score: number
  rank: number
  is_current_player?: boolean
}

export interface AuthResponse {
  user: User
  accessToken: string
}

export interface ApiError {
  message: string
  errors?: Record<string, string[]>
}
