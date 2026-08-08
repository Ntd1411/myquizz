-- 006_home_sections.sql
-- Configuration for the horizontal rails on the home page.
--
-- This table does NOT store which quizzes belong to a rail. It only stores the
-- rail's configuration: what to show, under which title, how many cards and in
-- which order. section_type is what tells the backend which query to run:
--   continue -> unfinished player sessions of the current user
--   featured -> quizzes where is_featured = true
--   trending / newest / category -> reserved, not used yet
--
-- Everything below the rails on the home page is the infinite feed, which does
-- not read this table at all.

create table if not exists home_sections (
  id serial not null primary key,
  section_key varchar(60) not null unique,
  title varchar(100) not null,
  section_type varchar(20) not null
    check (section_type in ('featured', 'continue', 'trending', 'newest', 'category')),
  -- Only meaningful when section_type = 'category'.
  category_name varchar(100),
  item_limit integer not null default 12 check (item_limit > 0),
  -- Numbered sparsely so new rails can be inserted in between without renumbering.
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default current_timestamp,
  updated_at timestamptz not null default current_timestamp
);

-- The home endpoint reads active rails ordered by position.
create index if not exists home_sections_active_position_idx
  on home_sections (position)
  where is_active = true;

-- Seed the only two rails of this phase. Idempotent so re-running is safe.
insert into home_sections (section_key, title, section_type, item_limit, position)
values
  ('continue', 'Continue playing', 'continue', 12, 0),
  ('featured', 'Staff picks', 'featured', 12, 10)
on conflict (section_key) do nothing;
