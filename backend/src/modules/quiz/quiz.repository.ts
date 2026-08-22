import { pool } from '../../infrastructure/database/connection.js'
import type { CreateQuestionRequest, CreateQuizRequest, UpdateQuizRequest } from './quiz.schema.js'
import type { Question, Quiz } from './quiz.type.js'
import { toQuizDetail } from './quiz.mapper.js'
import type { QuizDetailRow } from './quiz.mapper.js'

/**
 * Turns the request's flat option strings into the stored option objects.
 *
 * Both write paths must go through here. Create used to build these objects
 * inline while update stored the raw strings, so the same column ended up
 * holding two different shapes and clients rendered [object Object].
 */
function buildAnswerOptions(
  options: string[] | undefined
): { id: number; option_text: string }[] | undefined {
  if (!options) {
    return undefined
  }

  return options.map((option, index) => ({ id: index, option_text: option }))
}

/*
 * One statement for both write paths. They already drifted apart once over the
 * shape of answer_options, so the column list, the parameter order and the JSON
 * encoding now live in a single place.
 */
const INSERT_QUESTION_SQL = `INSERT INTO questions (quiz_id, question_type, question_text,
  time_limit, question_image, question_hint, explanation, answer_options, correct_answer)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`

/*
 * The parameters of INSERT_QUESTION_SQL, as a named tuple: the statement is
 * positional, so the compiler checks the order and arity against the column list
 * above rather than leaving it to a careful read. The optional slots are the
 * columns that stay NULL, including answer_options for the typed-answer types.
 */
type QuestionValues = [
  quizId: number,
  questionType: string,
  questionText: string,
  timeLimit: number,
  questionImage: string | undefined,
  questionHint: string | undefined,
  explanation: string | undefined,
  answerOptions: string | undefined,
  correctAnswer: string
]

function questionValues(quizId: number, question: CreateQuestionRequest): QuestionValues {
  return [
    quizId,
    question.question_type,
    question.question_text,
    question.time_limit,
    question.question_image,
    question.question_hint,
    question.explanation,
    JSON.stringify(buildAnswerOptions(question.answer_options)),
    JSON.stringify(question.correct_answer)
  ]
}

export class QuizRepository {
  async insertQuiz(
    userId: number,
    quizData: Omit<CreateQuizRequest, 'questions'>
  ): Promise<Quiz | null> {
    const result = await pool.query<Quiz>(
      `INSERT INTO quizzes (quiz_owner, quiz_name, quiz_description, 
      quiz_language, quiz_image, quiz_category, is_public) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        userId,
        quizData.quiz_name,
        quizData.quiz_description,
        quizData.quiz_language,
        quizData.quiz_image,
        quizData.quiz_category,
        quizData.is_public
      ]
    )
    return result.rows[0] || null
  }

  async insertQuestions(quizId: number, questions: CreateQuestionRequest[]): Promise<Question[]> {
    const insertedQuestions: Question[] = []
    for (const question of questions) {
      const result = await pool.query<Question>(
        INSERT_QUESTION_SQL,
        questionValues(quizId, question)
      )
      if (result.rows[0]) {
        insertedQuestions.push(result.rows[0])
      }
    }
    return insertedQuestions
  }

  async getQuizById(quizId: number): Promise<Quiz | null> {
    const quiz = await pool.query<QuizDetailRow>(
      `SELECT q.id, q.quiz_owner, q.quiz_name, q.quiz_description, q.quiz_language,
      q.quiz_image, q.quiz_category, q.is_public, q.question_count, q.play_count,
      q.created_at, q.updated_at,
      u.id as owner_id, u.fullname as owner_fullname, u.avatar as owner_avatar
      FROM quizzes q
      LEFT JOIN users u ON u.id = q.quiz_owner AND u.deleted_at IS NULL
      WHERE q.id = $1 AND q.deleted_at IS NULL`,
      [quizId]
    )

    const row = quiz.rows[0]

    if (!row) {
      return null
    }

    const questions = await pool.query<Question>(
      `SELECT id, quiz_id, question_type, question_text, question_image,
      question_hint, explanation, time_limit, answer_options, correct_answer,
      created_at, updated_at
      FROM questions
      WHERE quiz_id = $1 AND deleted_at IS NULL
      ORDER BY id ASC`,
      [quizId]
    )

    return toQuizDetail(row, questions.rows)
  }

  async updateQuizMetadata(
    quizId: number,
    userId: number,
    quizData: Omit<UpdateQuizRequest, 'questions'>
  ): Promise<Quiz | null> {
    const fieldsToUpdate: string[] = []
    const values: (string | number | boolean)[] = []
    let paramIndex = 1

    for (const [key, value] of Object.entries(quizData)) {
      if (value !== undefined) {
        fieldsToUpdate.push(`${key} = $${paramIndex}`)
        values.push(value)
        paramIndex++
      }
    }

    if (fieldsToUpdate.length === 0) {
      return null
    }

    values.push(quizId)
    values.push(userId)

    const updateQuery = `
      UPDATE quizzes 
      SET ${fieldsToUpdate.join(', ')}, updated_at = NOW() 
      WHERE id = $${paramIndex} AND quiz_owner = $${paramIndex + 1} 
      AND deleted_at IS NULL 
      RETURNING *`

    const result = await pool.query<Quiz>(updateQuery, values)
    return result.rows[0] || null
  }

  async replaceQuizQuestions(
    quizId: number,
    questions: CreateQuestionRequest[]
  ): Promise<Question[]> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Soft delete existing questions
      await client.query(
        'UPDATE questions SET deleted_at = NOW() WHERE quiz_id = $1 AND deleted_at IS NULL',
        [quizId]
      )

      // Insert new questions
      const newQuestions: Question[] = []
      for (const question of questions) {
        const result = await client.query<Question>(
          INSERT_QUESTION_SQL,
          questionValues(quizId, question)
        )
        if (result.rows[0]) {
          newQuestions.push(result.rows[0])
        }
      }

      await client.query('COMMIT')
      return newQuestions
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async checkQuizOwnership(quizId: number, userId: number): Promise<boolean> {
    const result = await pool.query(
      'SELECT id FROM quizzes WHERE id = $1 AND quiz_owner = $2 AND deleted_at IS NULL',
      [quizId, userId]
    )
    return result.rows.length > 0
  }

  /**
   * Hard delete: the row is gone, not flagged. RETURNING still hands back the row as it
   * was, which is all the caller needs in order to answer with it.
   *
   * Everything hanging off the quiz goes with it through the ON DELETE CASCADE chain the
   * schema declares: questions, quiz_snapshots, the game_sessions built on those
   * snapshots, and the player_sessions of those games. Deleting a quiz therefore also
   * deletes the play history of every match ever hosted from it, for every player.
   *
   * `deleted_at IS NULL` stays in the WHERE clause: a row soft deleted by the earlier
   * version of this endpoint is invisible to every read, so it answers 404 here too
   * instead of being silently swept away by a delete aimed at a live quiz.
   */
  async deleteQuiz(quizId: number): Promise<Quiz | null> {
    const result = await pool.query<Quiz>(
      `DELETE FROM quizzes
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *`,
      [quizId]
    )
    return result.rows[0] || null
  }
}
export const quizRepository = new QuizRepository()
