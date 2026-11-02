ALTER TABLE game_sessions
  ADD COLUMN IF NOT EXISTS paused_remaining_ms integer;

ALTER TABLE player_sessions
  ADD COLUMN IF NOT EXISTS player_clock jsonb;
