import { pool } from '../../infrastructure/database/connection.js'
import type { UpdateQuizRequest } from '../../shared/validators/schemas.js'
import type { Question, Quiz } from './quiz.type.js'

export class QuizRepository {
  async insertQuiz(
    userId: number,
    quizData: Omit<Quiz, 'id' | 'quiz_owner' | 'created_at' | 'updated_at' | 'deleted_at' | 'questions'>
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

  async insertQuestions(quizId: number, questions: Question[]): Promise<Question[]> {
    const insertedQuestions: Question[] = []
    for (const question of questions) {
      const result = await pool.query<Question>(
        `INSERT INTO questions (quiz_id, question_type, question_text, 
        question_image, answer_options, correct_answer) 
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          quizId,
          question.question_type,
          question.question_text,
          question.question_image,
          JSON.stringify(question.answer_options),
          JSON.stringify(question.correct_answer)
        ]
      )
      if (result.rows[0]) {
        insertedQuestions.push(result.rows[0])
      }
    }
    return insertedQuestions
  }

  async countQuizzesByOwner(ownerId: number): Promise<number> {
    const result = await pool.query<{ count: number }>(
      `SELECT COUNT(*) as count
      FROM quizzes
      WHERE quiz_owner = $1 AND deleted_at IS NULL`,
      [ownerId]
    )
    return Number(result.rows[0]?.count) || 0
  }

  async getListQuizzes(userId: number, offset: number, limit: number): Promise<Quiz[]> {
    const result = await pool.query<Quiz>(
      `SELECT id, quiz_owner, quiz_name, quiz_description, quiz_language,
      quiz_image, quiz_category, is_public, created_at, updated_at
      FROM quizzes
      WHERE quiz_owner = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    )

    return result.rows
  }

  async getQuizById(quizId: number): Promise<Quiz | null> {
    const quiz = await pool.query<Quiz>(
      `SELECT id, quiz_owner, quiz_name, quiz_description, quiz_language,
      quiz_image, quiz_category, is_public, created_at, updated_at
      FROM quizzes
      WHERE id = $1 AND deleted_at IS NULL`,
      [quizId]
    )

    if (!quiz.rows[0]) {
      return null
    }

    const questions = await pool.query<Question>(
      `SELECT id, quiz_id, question_type, question_text, question_image, 
      answer_options, correct_answer, created_at, updated_at
      FROM questions
      WHERE quiz_id = $1 AND deleted_at IS NULL`,
      [quizId]
    )

    const quizData = quiz.rows[0]
    quizData.questions = questions.rows

    return quizData
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

  async replaceQuizQuestions(quizId: number, questions: Question[]): Promise<Question[]> {
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
          `INSERT INTO questions (quiz_id, question_type, question_text, 
          question_image, answer_options, correct_answer) 
          VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [
            quizId,
            question.question_type,
            question.question_text,
            question.question_image,
            JSON.stringify(question.answer_options),
            JSON.stringify(question.correct_answer)
          ]
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

  async deleteQuiz(quizId: number): Promise<Quiz | null> {
    const result = await pool.query<Quiz>(
      `UPDATE quizzes SET deleted_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *`,
      [quizId]
    )
    return result.rows[0] || null
  }

  async searchQuizzes(
    offset: number,
    keyword?: string,
    language?: string,
    category?: string
  ): Promise<{ data: Quiz[], total: number }> {
    const fields: string[] = []
    const values: (string | number)[] = []
    let paramIndex = 1

    if (keyword) {
      fields.push(`(quiz_name ILIKE $${paramIndex} OR quiz_description ILIKE $${paramIndex})`)
      values.push(`%${keyword}%`)
      paramIndex++
    }

    if (language) {
      fields.push(`quiz_language = $${paramIndex}`)
      values.push(language)
      paramIndex++
    }

    if (category) {
      fields.push(`quiz_category = $${paramIndex}`)
      values.push(category)
      paramIndex++
    }

    if (fields.length === 0) {
      return { data: [], total: 0 }
    }

    const whereClause = `deleted_at IS NULL AND ${fields.join(' AND ')}`

    // Get total count first
    const countResult = await pool.query<{ count: number }>(
      `SELECT COUNT(*) as count
      FROM quizzes
      WHERE ${whereClause}`,
      values
    )
    const total = Number(countResult.rows[0]?.count) || 0

    // Get paginated data
    values.push(offset)
    const result = await pool.query<Quiz>(
      `SELECT id, quiz_owner, quiz_name, quiz_description, quiz_language,
      quiz_image, quiz_category, is_public, created_at, updated_at
      FROM quizzes
      WHERE ${whereClause}
      LIMIT 10 OFFSET $${paramIndex}`,
      values
    )

    return { data: result.rows, total }
  }
}
export const quizRepository = new QuizRepository()
