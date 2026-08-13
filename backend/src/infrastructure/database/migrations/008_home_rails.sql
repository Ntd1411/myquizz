-- 008_home_rails.sql
-- Activates the home rails that 006 declared but never seeded.
--
-- 006 created only two rows: Continue playing and Staff picks. Continue playing
-- needs a session and Staff picks needs an admin to flip is_featured, so a
-- logged-out visitor on a fresh database got an empty sections array and a home
-- page with nothing above the feed. The rows below need neither, so the page has
-- content from the first deploy.
--
-- trending is deliberately left out. getTrendingQuizzes runs the same visibility
-- filter and the same hot_score ordering as the first page of the infinite feed,
-- so a trending rail would show the exact cards repeated directly underneath it.
-- Give trending its own ranking window before seeding a row for it.
--
-- Category rails resolve to nothing until quizzes carry the matching
-- quiz_category, and empty rails are dropped from the response, so seeding them
-- on an empty database is harmless.

insert into home_sections (section_key, title, section_type, category_name, item_limit, position)
values
  ('newest', 'Fresh off the press', 'newest', null, 12, 20),
  ('category_science', 'Science', 'category', 'Science', 12, 30),
  ('category_geography', 'Geography', 'category', 'Geography', 12, 40)
on conflict (section_key) do nothing;
