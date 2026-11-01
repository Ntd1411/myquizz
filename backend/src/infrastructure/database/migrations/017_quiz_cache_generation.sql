CREATE TABLE IF NOT EXISTS quiz_cache_generation (
  id integer PRIMARY KEY CHECK (id = 1),
  generation bigint NOT NULL DEFAULT 1
);

INSERT INTO quiz_cache_generation (id) VALUES (1) ON CONFLICT DO NOTHING;
