import type { Socket } from 'socket.io'
import type { User } from '../../shared/types/shared.types.js'

export type GameStatus = 'waiting' | 'active' | 'finished';

export interface QuizSnapshotData {
  quiz_id: number;
  quiz_title: string;
  questions: {
    id: number;
    text: string;
    type: string;
    time_limit: number;
    answers: {
      id: number;
      text: string;
    }[];
  }[];
}

export interface GameSession {
  id: number;
  quiz_snapshot_id: number;
  session_name: string;
  session_code: string;
  session_host: number;
  total_players: number;
  total_questions: number;
  session_status: GameStatus;
  started_at: Date | null;
  finished_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface GameSessionWithQuizInfo extends GameSession {
  quiz_id: number;
  quiz_title: string;
  quiz_description: string;
}

export interface PlayerSession {
  id: number;
  game_session_id: number;
  player_id?: number;
  player_guest_id?: number;
  player_name: string;
  player_score: number;
  answered_questions: AnsweredQuestion[];
  current_question_index: number;
  created_at: Date;
  updated_at: Date;
}

export interface AnsweredQuestion {
  question_id: number;
  answer_id: number;
  is_correct: boolean;
  time_taken: number;
  score_earned: number;
  answered_at: Date;
}

export interface SubmitAnswerRequest {
  question_id: number;
  answer_id: number;
  time_taken: number;
}

export interface JoinGameResponse {
  player_session_id: number;
  player_name: string;
  game_info: GameSession;
}

export interface LeaderboardEntry {
  player_id: number;
  player_name: string;
  player_score: number;
  correct_answers_count: number;
  is_host: boolean;
  rank: number;
}

export interface QuestionData {
  question_id: number;
  question_text: string;
  question_type: string;
  time_limit: number;
  answers: {
    answer_text: string;
  }[];
  current_question: number;
  total_questions: number;
}

export interface AnswerResult {
  is_correct: boolean;
  score_earned: number;
  correct_answer_id: number;
  time_taken: number;
  total_score: number;
}

export interface GameResult {
  session_id: number;
  session_name: string;
  total_players: number;
  leaderboard: LeaderboardEntry[];
  finished_at: Date;
}

export interface AuthSocket extends Socket {
  user?: User
}
