-- refresh_sessions.refresh_token has a UNIQUE constraint and its own btree index.
DROP INDEX IF EXISTS refresh_token_idx;
