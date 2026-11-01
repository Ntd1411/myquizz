ALTER TABLE blacklist_token ADD COLUMN IF NOT EXISTS expires_at timestamptz;
UPDATE blacklist_token SET expires_at = created_at + interval '1 day' WHERE expires_at IS NULL;
ALTER TABLE blacklist_token ALTER COLUMN expires_at SET NOT NULL;
CREATE INDEX IF NOT EXISTS blacklist_token_expiry_idx ON blacklist_token (expires_at);
CREATE INDEX IF NOT EXISTS refresh_sessions_expiry_idx ON refresh_sessions (expires_at);
