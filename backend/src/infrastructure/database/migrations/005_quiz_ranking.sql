-- 005_quiz_ranking.sql
-- Adds denormalized counters, ranking columns and the Staff picks flag to quizzes.
--
-- Column ownership (do not mix these up):
--   question_count, play_count -> written by triggers in this file
--   completion_rate, hot_score, scored_at -> written by the scoring job (commit 2)
--   is_featured -> set manually by an admin
--
-- NOTE: quizzes_feed_idx below is a partial index whose WHERE clause must stay in
-- sync with the feed query. When moderation is added later (home_status column),
-- this index has to be dropped and recreated with "and home_status = 'approved'".

alter table quizzes
  add column if not exists question_count integer not null default 0,
  add column if not exists play_count integer not null default 0,
  add column if not exists completion_rate real not null default 0,
  add column if not exists hot_score double precision not null default 0,
  add column if not exists scored_at timestamptz,
  add column if not exists is_featured boolean not null default false;

-- ---------------------------------------------------------------------------
-- Trigger: keep quizzes.question_count in sync with live rows in questions
-- ---------------------------------------------------------------------------

create or replace function sync_quiz_question_count()
returns trigger as $$
declare
  affected_quiz_id integer;
begin
  -- On delete only OLD is populated; on insert only NEW is.
  affected_quiz_id := coalesce(new.quiz_id, old.quiz_id);

  update quizzes q
  set question_count = (
    select count(*)
    from questions qn
    where qn.quiz_id = affected_quiz_id
      and qn.deleted_at is null
  )
  where q.id = affected_quiz_id;

  -- A question may be moved between quizzes by an update; refresh the old quiz too.
  if tg_op = 'UPDATE' and old.quiz_id is distinct from new.quiz_id then
    update quizzes q
    set question_count = (
      select count(*)
      from questions qn
      where qn.quiz_id = old.quiz_id
        and qn.deleted_at is null
    )
    where q.id = old.quiz_id;
  end if;

  return null;
end;
$$ language plpgsql;

drop trigger if exists questions_sync_quiz_question_count on questions;

-- Fires on insert, on soft delete/restore, on hard delete and on quiz reassignment.
create trigger questions_sync_quiz_question_count
after insert or delete or update of deleted_at, quiz_id on questions
for each row
execute function sync_quiz_question_count();

-- ---------------------------------------------------------------------------
-- Trigger: increment quizzes.play_count on every new game session
-- ---------------------------------------------------------------------------

create or replace function bump_quiz_play_count()
returns trigger as $$
begin
  -- game_sessions points at a snapshot, not at the quiz, so resolve it first.
  update quizzes q
  set play_count = q.play_count + 1
  from quiz_snapshots qs
  where qs.id = new.quiz_snapshot_id
    and q.id = qs.quiz_id;

  return null;
end;
$$ language plpgsql;

drop trigger if exists game_sessions_bump_quiz_play_count on game_sessions;

-- Insert only: play_count is an all-time total and is never decremented.
create trigger game_sessions_bump_quiz_play_count
after insert on game_sessions
for each row
execute function bump_quiz_play_count();

-- ---------------------------------------------------------------------------
-- Backfill existing rows
-- ---------------------------------------------------------------------------

-- question_count: live questions per quiz.
update quizzes q
set question_count = coalesce(counts.total, 0)
from (
  select quiz_id, count(*) as total
  from questions
  where deleted_at is null
  group by quiz_id
) counts
where q.id = counts.quiz_id;

-- play_count: all-time game sessions per quiz, resolved through snapshots.
update quizzes q
set play_count = coalesce(counts.total, 0)
from (
  select qs.quiz_id, count(*) as total
  from game_sessions gs
  join quiz_snapshots qs on qs.id = gs.quiz_snapshot_id
  group by qs.quiz_id
) counts
where q.id = counts.quiz_id;

-- completion_rate: share of players that reached 'finished'.
-- The scoring job recomputes this every run; this backfill only avoids a cold start.
update quizzes q
set completion_rate = coalesce(rates.rate, 0)
from (
  select qs.quiz_id,
         count(*) filter (where ps.status = 'finished')::real
           / nullif(count(*), 0) as rate
  from player_sessions ps
  join game_sessions gs on gs.id = ps.game_session_id
  join quiz_snapshots qs on qs.id = gs.quiz_snapshot_id
  group by qs.quiz_id
) rates
where q.id = rates.quiz_id;

-- ---------------------------------------------------------------------------
-- Index backing keyset pagination on the home feed
-- ---------------------------------------------------------------------------

create index if not exists quizzes_feed_idx
  on quizzes (hot_score desc, id desc)
  where deleted_at is null and is_public = true;
