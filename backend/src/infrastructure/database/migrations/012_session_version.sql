ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;

ALTER TABLE refresh_sessions ADD COLUMN IF NOT EXISTS family_id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE INDEX IF NOT EXISTS refresh_sessions_family_idx ON refresh_sessions (family_id, user_id);

CREATE TABLE IF NOT EXISTS consumed_refresh_tokens (
  token_hash varchar(64) PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id uuid NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS consumed_refresh_tokens_expiry_idx ON consumed_refresh_tokens (expires_at);
