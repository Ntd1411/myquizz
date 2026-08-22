-- reset-db.sql
-- Empties every application table so the Open Trivia DB catalogue can be
-- imported into a clean database. The demo seed is throwaway data, so nothing
-- here tries to preserve it: this wipes it along with every account, quiz and
-- session created by hand while testing.
--
-- Run it through the wrapper, which reports counts and asks for confirmation:
--   pnpm db:reset --yes
--
-- Or directly, when only psql is available:
--   psql "$DATABASE_URL" --single-transaction -f scripts/sql/reset-db.sql
--
-- What survives on purpose:
--   schema_migrations  Migration bookkeeping. Truncating it would make
--                      pnpm db:migrate replay every schema file on next boot.
--   home_sections      Home rail configuration. Migrations 006 and 008 insert
--                      those rows with "on conflict do nothing", and a
--                      migration only ever runs once, so a truncated
--                      home_sections would stay empty forever and the home
--                      page would lose its rails.
--
-- Everything else goes. Truncating users alone would already cascade through
-- most of it, but the tables are listed explicitly so the intent is readable,
-- and so blacklist_token gets included: it has no foreign key to users.
--
-- restart identity resets the sequences, so imported quizzes start at id 1.
--
-- TRUNCATE takes an ACCESS EXCLUSIVE lock on every table listed. Stop the API
-- first, or expect requests to block until this finishes.

truncate table
  player_sessions,
  game_sessions,
  quiz_snapshots,
  questions,
  quizzes,
  refresh_sessions,
  blacklist_token,
  users
restart identity cascade;
