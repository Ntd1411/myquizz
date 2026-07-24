CREATE TABLE game_sessions (
  id serial NOT NULL PRIMARY KEY,
  quiz_snapshot_id int NOT NULL REFERENCES quiz_snapshots(id) ON DELETE CASCADE,
  session_name varchar(255) NOT NULL,
  session_code varchar(10) NOT NULL UNIQUE,
  session_host int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_players int NOT NULL DEFAULT 0,
  total_questions int NOT NULL DEFAULT 0,
  session_status varchar(50) NOT NULL DEFAULT 'lobby' CHECK (session_status IN ('lobby','active','paused','finished','cancelled')),
  game_mode varchar(50) NOT NULL DEFAULT 'classic' CHECK (game_mode IN ('classic','solo','marathon','team','survival','practice')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_question_index int NOT NULL DEFAULT 0, --host-paced
  current_phase varchar(30) NOT NULL DEFAULT 'lobby',
  phase_ends_at timestamptz,
  started_at timestamptz DEFAULT NULL,
  finished_at timestamptz DEFAULT NULL,
  deleted_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT current_timestamp,
  updated_at timestamptz DEFAULT current_timestamp
);
CREATE INDEX game_session_snapshot_id_idx ON game_sessions (quiz_snapshot_id);
CREATE INDEX game_session_host_idx ON game_sessions (session_host);