CREATE OR REPLACE FUNCTION bump_quiz_cache_generation()
RETURNS trigger AS $$
BEGIN
  UPDATE quiz_cache_generation
  SET generation = generation + 1
  WHERE id = 1;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- These columns change membership, ordering, or content of public listing
-- caches. Keep question_count out of this trigger: question imports update it
-- once per row, while the quiz service invalidates once after the whole batch.
DROP TRIGGER IF EXISTS quizzes_cache_insert_delete ON quizzes;
CREATE TRIGGER quizzes_cache_insert_delete
AFTER INSERT OR DELETE ON quizzes
FOR EACH ROW EXECUTE FUNCTION bump_quiz_cache_generation();

DROP TRIGGER IF EXISTS quizzes_cache_listing_update ON quizzes;
CREATE TRIGGER quizzes_cache_listing_update
AFTER UPDATE OF quiz_name, quiz_description, quiz_language, quiz_image,
  quiz_category, is_public, is_featured, deleted_at, play_count ON quizzes
FOR EACH ROW EXECUTE FUNCTION bump_quiz_cache_generation();
