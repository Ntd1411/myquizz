CREATE TABLE player_sessions (
  id serial NOT NULL PRIMARY KEY,
  game_session_id int NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  quiz_id int REFERENCES quizzes(id) ON DELETE CASCADE,
  player_id int REFERENCES users(id) ON DELETE CASCADE,
  player_guest_id varchar(255),
  player_name varchar(255) NOT NULL,
  player_score int NOT NULL DEFAULT 0,
  answered_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answers_count int NOT NULL DEFAULT 0,
  streak int NOT NULL DEFAULT 0,
  lives int CHECK (lives >= 0),
  current_question_index int NOT NULL DEFAULT 0,   -- self-paced
  status varchar(20) NOT NULL DEFAULT 'connected' CHECK (status IN ('connected','disconnected','eliminated','finished')),
  deleted_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT current_timestamp,
  updated_at timestamptz DEFAULT current_timestamp
);
CREATE INDEX idx_player_sessions_game_session_id ON player_sessions(game_session_id);
CREATE INDEX idx_player_sessions_player_id ON player_sessions(player_id);
