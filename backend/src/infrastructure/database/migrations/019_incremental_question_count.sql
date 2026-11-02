CREATE OR REPLACE FUNCTION sync_quiz_question_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.deleted_at IS NULL THEN
      UPDATE quizzes SET question_count = question_count + 1 WHERE id = NEW.quiz_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.deleted_at IS NULL THEN
      UPDATE quizzes SET question_count = greatest(0, question_count - 1) WHERE id = OLD.quiz_id;
    END IF;
  ELSIF OLD.quiz_id = NEW.quiz_id THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      UPDATE quizzes SET question_count = greatest(0, question_count - 1) WHERE id = NEW.quiz_id;
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      UPDATE quizzes SET question_count = question_count + 1 WHERE id = NEW.quiz_id;
    END IF;
  ELSE
    IF OLD.deleted_at IS NULL THEN
      UPDATE quizzes SET question_count = greatest(0, question_count - 1) WHERE id = OLD.quiz_id;
    END IF;
    IF NEW.deleted_at IS NULL THEN
      UPDATE quizzes SET question_count = question_count + 1 WHERE id = NEW.quiz_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
