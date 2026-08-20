-- 011_game_history_indexes.sql
-- Indexes backing GET /games/history. No columns are added or changed here.
--
-- The list is keyed on (coalesce(finished_at, created_at) DESC, id DESC): a room
-- that was cancelled before it ever ended has finished_at = null, and it still
-- belongs in the history, so the fallback is part of the ordering itself. The
-- expression below has to stay byte-identical to ENDED_AT in game.repository.ts,
-- or Postgres stops matching the index and sorts the rows instead.

-- Hosted tab: one host's closed rooms, newest first.
create index if not exists game_sessions_host_ended_idx
  on game_sessions (session_host, coalesce(finished_at, created_at) desc, id desc)
  where deleted_at is null;

-- Played tab: the ordering side of the join, once a viewer's rows are found.
create index if not exists game_sessions_ended_idx
  on game_sessions (coalesce(finished_at, created_at) desc, id desc)
  where deleted_at is null;

-- Played tab, lookup side: every match one account took part in. Without this a
-- page turn is a sequential scan of player_sessions.
create index if not exists player_sessions_player_recent_idx
  on player_sessions (player_id, id desc)
  where deleted_at is null;

-- Same for a guest, whose only identity is the UUID in their browser.
create index if not exists player_sessions_guest_recent_idx
  on player_sessions (player_guest_id, id desc)
  where deleted_at is null;
