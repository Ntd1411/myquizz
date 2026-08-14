import type { QuizOwner } from './home.type.js'

export interface Quiz {
  id: number;
  quiz_owner: number;
  /** Joined author. Null when the author row was soft deleted. Detail reads only. */
  owner?: QuizOwner | null;
  quiz_name: string;
  quiz_description?: string;
  quiz_language: string;
  quiz_image?: string;
  quiz_category?: string;
  is_public: boolean;
  /** Counters kept on the quizzes table. Absent on rows built from RETURNING *. */
  question_count?: number;
  play_count?: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  questions: Question[];
}

export interface Question {
  id: number;
  question_type:'multiple_choice' | 'multiple_select' | 'short_answer' | 'long_answer';
  question_text: string;
  time_limit: number;
  correct_answer: number[] | string;
  question_hint?: string | undefined;
  explanation?: string | undefined;
  question_image?: string | undefined;
  answer_options?:
    {
      id: number;
      option_text: string;
    }[] | undefined;
  quiz_id: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}
