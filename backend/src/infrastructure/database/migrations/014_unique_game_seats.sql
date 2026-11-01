CREATE UNIQUE INDEX IF NOT EXISTS player_sessions_user_seat_uidx
  ON player_sessions (game_session_id, player_id)
  WHERE player_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS player_sessions_guest_seat_uidx
  ON player_sessions (game_session_id, player_guest_id)
  WHERE player_guest_id IS NOT NULL AND deleted_at IS NULL;
