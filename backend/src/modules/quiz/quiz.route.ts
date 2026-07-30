import { Router } from 'express'
import { authMiddleware } from '../auth/auth.middleware.js'
import * as quizController from './quiz.controller.js'
import {
  validateBody,
  validateQuery
} from '../../shared/validators/validator.js'
import {
  createQuizSchema,
  listQuizzesSchema,
  searchQuizzesSchema,
  updateQuizSchema
} from './quiz.schema.js'
import { optionalAuthMiddleware } from '../../shared/middlewares/optional.auth.js'

export const quizRouter: Router = Router()

/**
 * @swagger
 * /api/v1/quizzes:
 *   post:
 *     summary: Tạo quiz mới
 *     tags: [Quizzes]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quiz_name
 *               - quiz_language
 *               - is_public
 *               - questions
 *             properties:
 *               quiz_name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *                 example: Javascript Quiz
 *               quiz_description:
 *                 type: string
 *                 maxLength: 500
 *                 example: Test your Javascript knowledge
 *               quiz_language:
 *                 type: string
 *                 example: vi
 *               quiz_image:
 *                 type: string
 *                 format: uri
 *                 example: https://example.com/image.jpg
 *               quiz_category:
 *                 type: string
 *                 maxLength: 50
 *                 example: Programming
 *               is_public:
 *                 type: boolean
 *                 example: true
 *               questions:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - question_type
 *                     - question_text
 *                     - correct_answer
 *                   properties:
 *                     question_type:
 *                       type: string
 *                       enum: [multiple_choice, multiple_select, short_answer, long_answer]
 *                       example: multiple_choice
 *                     question_text:
 *                       type: string
 *                       minLength: 1
 *                       maxLength: 200
 *                       example: What is JavaScript?
 *                     time_limit:
 *                       type: number
 *                       minimum: 0
 *                       default: 30
 *                       example: 30
 *                     question_image:
 *                       type: string
 *                       format: uri
 *                       example: https://example.com/question-image.jpg
 *                     answer_options:
 *                       type: array
 *                       minItems: 2
 *                       maxItems: 4
 *                       items:
 *                         type: string
 *                         minLength: 1
 *                         maxLength: 100
 *                       example: ["A programming language", "A coffee type", "A framework", "A database"]
 *                     correct_answer:
 *                       oneOf:
 *                         - type: array
 *                           items:
 *                             type: number
 *                           minItems: 1
 *                           example: [0]
 *                         - type: string
 *                           minLength: 1
 *                           example: "A programming language"
 *     responses:
 *       201:
 *         description: Tạo quiz thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: number
 *                   example: 1
 *                 quiz_owner:
 *                   type: number
 *                   example: 7
 *                 quiz_name:
 *                   type: string
 *                   example: Javascript Quiz
 *                 quiz_description:
 *                   type: string
 *                   example: Test your Javascript knowledge
 *                 quiz_language:
 *                   type: string
 *                   example: vi
 *                 quiz_image:
 *                   type: string
 *                   example: https://example.com/image.jpg
 *                 quiz_category:
 *                   type: string
 *                   example: Programming
 *                 is_public:
 *                   type: boolean
 *                   example: true
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi khi tạo quiz
 */
quizRouter.post(
  '/',
  authMiddleware,
  validateBody(createQuizSchema),
  quizController.createQuiz
)

/**
 * @swagger
 * /api/v1/quizzes/search:
 *   get:
 *     summary: Tìm kiếm quiz
 *     tags: [Quizzes]
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *           maxLength: 200
 *         description: Từ khóa tìm kiếm
 *         example: javascript
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *           maxLength: 50
 *         description: Ngôn ngữ
 *         example: vi
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           maxLength: 50
 *         description: Danh mục
 *         example: Programming
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 10
 *         description: Số lượng kết quả mỗi trang
 *     responses:
 *       200:
 *         description: Danh sách quiz
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: number
 *                       quiz_owner:
 *                         type: number
 *                       quiz_name:
 *                         type: string
 *                       quiz_description:
 *                         type: string
 *                       quiz_language:
 *                         type: string
 *                       quiz_image:
 *                         type: string
 *                       quiz_category:
 *                         type: string
 *                       is_public:
 *                         type: boolean
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     total:
 *                       type: number
 *                     totalPages:
 *                       type: number
 *                     hasPreviousPage:
 *                       type: boolean
 *                     hasNextPage:
 *                       type: boolean
 */
quizRouter.get(
  '/search',
  optionalAuthMiddleware,
  validateQuery(searchQuizzesSchema),
  quizController.searchQuizzes
)

/**
 * @swagger
 * /api/v1/quizzes/users/id/{ownerId}:
 *   get:
 *     summary: Lấy danh sách quiz của user
 *     tags: [Quizzes]
 *     parameters:
 *       - in: path
 *         name: ownerId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của user
 *         example: 1
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 20
 *           default: 10
 *     responses:
 *       200:
 *         description: Danh sách quiz của user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: number
 *                       quiz_owner:
 *                         type: number
 *                       quiz_name:
 *                         type: string
 *                       quiz_description:
 *                         type: string
 *                       quiz_language:
 *                         type: string
 *                       quiz_image:
 *                         type: string
 *                       quiz_category:
 *                         type: string
 *                       is_public:
 *                         type: boolean
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     total:
 *                       type: number
 *                     totalPages:
 *                       type: number
 *                     hasPreviousPage:
 *                       type: boolean
 *                     hasNextPage:
 *                       type: boolean
 */
quizRouter.get(
  '/users/id/:ownerId',
  optionalAuthMiddleware,
  validateQuery(listQuizzesSchema),
  quizController.listQuizzes
)

/**
 * @swagger
 * /api/v1/quizzes/id/{quizId}:
 *   get:
 *     summary: Lấy chi tiết quiz
 *     tags: [Quizzes]
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của quiz
 *         example: 1
 *     responses:
 *       200:
 *         description: Chi tiết quiz
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: number
 *                   example: 1
 *                 quiz_owner:
 *                   type: number
 *                   example: 7
 *                 quiz_name:
 *                   type: string
 *                   example: Javascript Quiz
 *                 quiz_description:
 *                   type: string
 *                   example: Test your Javascript knowledge
 *                 quiz_language:
 *                   type: string
 *                   example: vi
 *                 quiz_image:
 *                   type: string
 *                   example: https://example.com/image.jpg
 *                 quiz_category:
 *                   type: string
 *                   example: Programming
 *                 is_public:
 *                   type: boolean
 *                   example: true
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *                 questions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: number
 *                       quiz_id:
 *                         type: number
 *                       question_type:
 *                         type: string
 *                       question_text:
 *                         type: string
 *                       question_image:
 *                         type: string
 *                       answer_options:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: number
 *                             option_text:
 *                               type: string
 *                       correct_answer:
 *                         type: array
 *                         items:
 *                           type: number
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: Không tìm thấy quiz
 */
quizRouter.get('/id/:quizId', optionalAuthMiddleware, quizController.getQuiz)

/**
 * @swagger
 * /api/v1/quizzes/id/{quizId}:
 *   patch:
 *     summary: Cập nhật quiz
 *     tags: [Quizzes]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của quiz
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Tất cả các trường đều optional. Chỉ gửi các trường cần update.
 *             properties:
 *               quiz_name:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *                 example: Updated Quiz Name
 *               quiz_description:
 *                 type: string
 *                 maxLength: 500
 *                 example: Updated description
 *               quiz_language:
 *                 type: string
 *                 example: en
 *               quiz_image:
 *                 type: string
 *                 format: uri
 *                 example: https://example.com/new-image.jpg
 *               quiz_category:
 *                 type: string
 *                 maxLength: 50
 *                 example: Web Development
 *               is_public:
 *                 type: boolean
 *                 example: false
 *               questions:
 *                 type: array
 *                 description: Nếu update questions, phải gửi toàn bộ danh sách questions mới
 *                 items:
 *                   type: object
 *                   required:
 *                     - question_type
 *                     - question_text
 *                     - correct_answer
 *                   properties:
 *                     question_type:
 *                       type: string
 *                       enum: [multiple_choice, multiple_select, short_answer, long_answer]
 *                       example: multiple_choice
 *                     question_text:
 *                       type: string
 *                       minLength: 1
 *                       maxLength: 200
 *                       example: Updated question text
 *                     time_limit:
 *                       type: number
 *                       minimum: 0
 *                       default: 30
 *                       example: 30
 *                     question_image:
 *                       type: string
 *                       format: uri
 *                       description: Optional. Phải là URL hợp lệ nếu có
 *                       example: https://example.com/question-image.jpg
 *                     answer_options:
 *                       type: array
 *                       description: Required cho multiple_choice và multiple_select. Tối thiểu 2 options
 *                       minItems: 2
 *                       items:
 *                         type: string
 *                         minLength: 1
 *                         maxLength: 100
 *                       example: ["Option A", "Option B", "Option C"]
 *                     correct_answer:
 *                       description: Array of indexes cho multiple choice hoặc string cho text answer
 *                       oneOf:
 *                         - type: array
 *                           items:
 *                             type: number
 *                           minItems: 1
 *                           example: [0]
 *                         - type: string
 *                           minLength: 1
 *                           example: "Correct answer text"
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: number
 *                   example: 1
 *                 quiz_owner:
 *                   type: number
 *                   example: 7
 *                 quiz_name:
 *                   type: string
 *                   example: Updated Quiz Name
 *                 quiz_description:
 *                   type: string
 *                   example: Updated description
 *                 quiz_language:
 *                   type: string
 *                   example: en
 *                 quiz_image:
 *                   type: string
 *                   example: https://example.com/new-image.jpg
 *                 quiz_category:
 *                   type: string
 *                   example: Web Development
 *                 is_public:
 *                   type: boolean
 *                   example: false
 *                 deleted_at:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                   example: 2026-07-17T09:58:29.162Z
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *                   example: 2026-07-17T10:13:42.540Z
 *                 questions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: number
 *                         example: 3
 *                       quiz_id:
 *                         type: number
 *                         example: 1
 *                       question_type:
 *                         type: string
 *                         example: multiple_choice
 *                       question_text:
 *                         type: string
 *                         example: Updated question text
 *                       question_image:
 *                         type: string
 *                         example: https://example.com/question-image.jpg
 *                       answer_options:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["Option A", "Option B", "Option C"]
 *                       correct_answer:
 *                         type: array
 *                         items:
 *                           type: number
 *                         example: [0]
 *                       deleted_at:
 *                         type: string
 *                         nullable: true
 *                         example: null
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                         example: 2026-07-17T10:13:42.546Z
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *                         example: 2026-07-17T10:13:42.546Z
 *                       time_limit:
 *                         type: number
 *                         example: 30
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền chỉnh sửa
 *       404:
 *         description: Không tìm thấy quiz
 */
quizRouter.patch(
  '/id/:quizId',
  authMiddleware,
  validateBody(updateQuizSchema),
  quizController.updateQuiz
)

/**
 * @swagger
 * /api/v1/quizzes/id/{quizId}:
 *   delete:
 *     summary: Xóa quiz
 *     tags: [Quizzes]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của quiz
 *         example: 1
 *     responses:
 *       200:
 *         description: Xóa thành công
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền xóa
 *       404:
 *         description: Không tìm thấy quiz
 */
quizRouter.delete('/id/:quizId', authMiddleware, quizController.deleteQuiz)

// quizRouter.post('/id/:quizId/image', authMiddleware, quizController.uploadQuizImage)
