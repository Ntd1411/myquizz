-- 007_quiz_listing_indexes.sql
-- Indexes backing the reworked quiz listing endpoints: search, public profile
-- and /quizzes/me. No columns are added or changed here; this migration only
-- turns the new keyset orderings into index scans instead of full sorts.
--
-- NOTE: every index below whose predicate contains "is_public = true" is a
-- partial index tied to the public visibility rule, exactly like
-- quizzes_feed_idx from 005_quiz_ranking.sql. When moderation is added later
-- (a home_status column), each of these must be dropped and recreated with an
-- added "and home_status = 'approved'", or the partial predicate stops matching
-- the listing queries and Postgres falls back to a sort.
--
-- quizzes_owner_updated_idx is deliberately NOT partial on is_public:
-- /quizzes/me shows owners their private and empty quizzes too, so it has to
-- cover every non-deleted row of an owner.

-- search sort=newest / sort=oldest: (created_at, id) over public quizzes.
create index if not exists quizzes_public_recent_idx
  on quizzes (created_at desc, id desc)
  where deleted_at is null and is_public = true;

-- search sort=name_asc / sort=name_desc: case-insensitive name, id tie-breaker.
-- One ascending index serves both directions since Postgres scans it backward.
create index if not exists quizzes_public_name_idx
  on quizzes (lower(quiz_name), id)
  where deleted_at is null and is_public = true;

-- search sort=most_played: (play_count, id) over public quizzes.
create index if not exists quizzes_public_plays_idx
  on quizzes (play_count desc, id desc)
  where deleted_at is null and is_public = true;

-- public profile (GET /quizzes/users/id/:ownerId): one owner's public quizzes,
-- newest first.
create index if not exists quizzes_owner_public_recent_idx
  on quizzes (quiz_owner, created_at desc, id desc)
  where deleted_at is null and is_public = true;

-- /quizzes/me: the caller's own quizzes, most recently updated first. Covers
-- private and empty quizzes on purpose (see NOTE above).
create index if not exists quizzes_owner_updated_idx
  on quizzes (quiz_owner, updated_at desc, id desc)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Optional: trigram acceleration for keyword search (ILIKE on quiz_name and
-- quiz_description). Keyword search works without it, only slower via a
-- sequential scan, so it stays commented out to keep this migration runnable
-- where creating extensions is not permitted. Enable it wherever pg_trgm is
-- available.
-- ---------------------------------------------------------------------------
-- create extension if not exists pg_trgm;
--
-- create index if not exists quizzes_name_trgm_idx
--   on quizzes using gin (quiz_name gin_trgm_ops)
--   where deleted_at is null;
--
-- create index if not exists quizzes_description_trgm_idx
--   on quizzes using gin (quiz_description gin_trgm_ops)
--   where deleted_at is null;
