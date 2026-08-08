/* eslint-disable max-len */
import { Router } from 'express'
import { authMiddleware } from '../auth/auth.middleware.js'
import * as quizController from './quiz.controller.js'
import {
  validateBody,
  validateQuery
} from '../../shared/validators/validator.js'
import {
  createQuizSchema,
  feedQuerySchema,
  listQuizzesSchema,
  searchQuizzesSchema,
  updateQuizSchema
} from './quiz.schema.js'
import { optionalAuthMiddleware } from '../../shared/middlewares/optional.auth.js'
import * as homeController from './home.controller.js'

export const quizRouter: Router = Router()

quizRouter.post( '/', authMiddleware, validateBody(createQuizSchema), quizController.createQuiz)

quizRouter.get( '/search', optionalAuthMiddleware, validateQuery(searchQuizzesSchema), quizController.searchQuizzes)

quizRouter.get('/home', optionalAuthMiddleware, homeController.getHome)

quizRouter.get('/feed', optionalAuthMiddleware, validateQuery(feedQuerySchema), homeController.getFeed)

quizRouter.get( '/users/id/:ownerId', optionalAuthMiddleware, validateQuery(listQuizzesSchema), quizController.listQuizzes)

quizRouter.get('/id/:quizId', optionalAuthMiddleware, quizController.getQuiz)

quizRouter.patch( '/id/:quizId', authMiddleware, validateBody(updateQuizSchema), quizController.updateQuiz)

quizRouter.delete('/id/:quizId', authMiddleware, quizController.deleteQuiz)

/**
 * @openapi
 * tags:
 *   - name: Quizzes
 *     description: Quiz CRUD, search, home sections, and public discovery feed
 *
 * /quizzes:
 *   post:
 *     summary: Create a quiz with its questions
 *     description: Creates a quiz owned by the authenticated user. The questions array is required and is persisted with the quiz.
 *     tags: [Quizzes]
 *     security: [ { cookieAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateQuizRequest'
 *           examples:
 *             multipleChoice:
 *               summary: Public multiple-choice quiz
 *               value:
 *                 quiz_name: JavaScript Basics
 *                 quiz_description: Quick warm-up questions for beginners
 *                 quiz_language: en
 *                 quiz_image: https://cdn.example.com/quizzes/javascript.png
 *                 quiz_category: Programming
 *                 is_public: true
 *                 questions:
 *                   - question_type: multiple_choice
 *                     question_text: Which keyword declares a block-scoped variable?
 *                     time_limit: 30
 *                     answer_options: [var, let, function, return]
 *                     correct_answer: [1]
 *             shortAnswer:
 *               summary: Private short-answer quiz
 *               value:
 *                 quiz_name: Vocabulary Drill
 *                 quiz_language: en
 *                 quiz_category: English
 *                 is_public: false
 *                 questions:
 *                   - question_type: short_answer
 *                     question_text: What is the opposite of hot?
 *                     time_limit: 20
 *                     correct_answer: cold
 *     responses:
 *       201:
 *         description: Quiz created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       required: [quiz]
 *                       properties:
 *                         quiz: { $ref: '#/components/schemas/Quiz' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *
 * /quizzes/search:
 *   get:
 *     summary: Search quizzes
 *     description: Searches quizzes with offset pagination. Authentication is optional; authenticated callers can also see their own private quizzes when allowed by service rules.
 *     tags: [Quizzes]
 *     parameters:
 *       - in: query
 *         name: keyword
 *         description: Text matched against quiz fields.
 *         schema: { type: string, maxLength: 200 }
 *         example: javascript
 *       - in: query
 *         name: language
 *         description: Exact quiz language filter.
 *         schema: { type: string, maxLength: 50 }
 *         example: en
 *       - in: query
 *         name: category
 *         description: Exact quiz category filter.
 *         schema: { type: string, maxLength: 50 }
 *         example: Programming
 *       - in: query
 *         name: page
 *         description: 1-based page number.
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         description: Number of quizzes per page.
 *         schema: { type: integer, minimum: 1, maximum: 20, default: 10 }
 *     responses:
 *       200:
 *         description: Search results under data.quizzes; offset pagination under meta.pagination.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       required: [quizzes]
 *                       properties:
 *                         quizzes:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/Quiz' }
 *                     meta:
 *                       allOf:
 *                         - $ref: '#/components/schemas/ApiMeta'
 *                         - type: object
 *                           properties:
 *                             pagination: { $ref: '#/components/schemas/Pagination' }
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *
 * /quizzes/home:
 *   get:
 *     summary: Get home screen quiz sections
 *     description: Returns active horizontal home sections such as Continue playing and Staff picks. Empty sections are omitted. Authentication is optional; anonymous callers simply do not receive personalized Continue playing items.
 *     tags: [Quizzes]
 *     responses:
 *       200:
 *         description: Home sections ready for rendering.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       required: [sections]
 *                       properties:
 *                         sections:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/HomeSection' }
 *                     meta:
 *                       allOf:
 *                         - $ref: '#/components/schemas/ApiMeta'
 *                         - type: object
 *                           properties:
 *                             cached:
 *                               type: boolean
 *                               description: True when the response came from cache.
 *             examples:
 *               authenticated:
 *                 summary: Authenticated user with two sections
 *                 value:
 *                   success: true
 *                   data:
 *                     sections:
 *                       - section_key: continue
 *                         title: Continue playing
 *                         section_type: continue
 *                         items:
 *                           - id: 42
 *                             quiz_name: Algebra Sprint
 *                             quiz_description: Finish your latest practice session
 *                             quiz_image: https://cdn.example.com/algebra.png
 *                             quiz_category: Math
 *                             quiz_language: en
 *                             quiz_owner: 3
 *                             question_count: 12
 *                             play_count: 35
 *                             completion_rate: 0.73
 *                             created_at: '2026-08-01T10:00:00.000Z'
 *                       - section_key: featured
 *                         title: Staff picks
 *                         section_type: featured
 *                         items: []
 *                   error: null
 *                   meta:
 *                     timestamp: '2026-08-08T15:00:00.000Z'
 *                     cached: false
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *
 * /quizzes/feed:
 *   get:
 *     summary: Get cursor-based public quiz feed
 *     description: Returns a keyset-paginated infinite feed ordered by ranking score. Only public, non-deleted quizzes with at least one question are eligible. The cursor is opaque and must be reused exactly as returned by nextCursor.
 *     tags: [Quizzes]
 *     parameters:
 *       - in: query
 *         name: topic
 *         description: Optional category filter mapped to quiz_category.
 *         schema: { type: string, maxLength: 50 }
 *         example: Programming
 *       - in: query
 *         name: cursor
 *         description: Opaque cursor from the previous response's meta.pagination.nextCursor.
 *         schema: { type: string, maxLength: 200 }
 *         example: MC45ODc2fDEyMw
 *       - in: query
 *         name: limit
 *         description: Number of quizzes to return.
 *         schema: { type: integer, minimum: 1, maximum: 24, default: 12 }
 *     responses:
 *       200:
 *         description: Feed page under data.quizzes; cursor state under meta.pagination.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       required: [quizzes]
 *                       properties:
 *                         quizzes:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/QuizCard' }
 *                     meta:
 *                       allOf:
 *                         - $ref: '#/components/schemas/ApiMeta'
 *                         - type: object
 *                           properties:
 *                             cached:
 *                               type: boolean
 *                               description: True when the response came from cache.
 *                             pagination: { $ref: '#/components/schemas/CursorPagination' }
 *             examples:
 *               firstPage:
 *                 summary: First feed page
 *                 value:
 *                   success: true
 *                   data:
 *                     quizzes:
 *                       - id: 10
 *                         quiz_name: JavaScript Basics
 *                         quiz_description: Quick warm-up questions
 *                         quiz_image: https://cdn.example.com/js.png
 *                         quiz_category: Programming
 *                         quiz_language: en
 *                         quiz_owner: 3
 *                         question_count: 8
 *                         play_count: 120
 *                         completion_rate: 0.66
 *                         created_at: '2026-08-01T10:00:00.000Z'
 *                   error: null
 *                   meta:
 *                     timestamp: '2026-08-08T15:00:00.000Z'
 *                     cached: false
 *                     pagination:
 *                       limit: 12
 *                       nextCursor: MC45ODc2fDEyMw
 *                       hasMore: true
 *       400:
 *         description: Invalid query parameters or malformed feed cursor
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *
 * /quizzes/users/id/{ownerId}:
 *   get:
 *     summary: List a user's quizzes
 *     description: Lists quizzes for one owner with offset pagination. Authentication is optional and determines whether private quizzes may be visible to the caller.
 *     tags: [Quizzes]
 *     parameters:
 *       - { in: path, name: ownerId, required: true, schema: { type: integer, minimum: 1 }, description: Owner user id }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 }, description: 1-based page number }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 20, default: 10 }, description: Number of quizzes per page }
 *     responses:
 *       200:
 *         description: Owner quizzes under data.quizzes; offset pagination under meta.pagination.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       required: [quizzes]
 *                       properties:
 *                         quizzes:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/Quiz' }
 *                     meta:
 *                       allOf:
 *                         - $ref: '#/components/schemas/ApiMeta'
 *                         - type: object
 *                           properties:
 *                             pagination: { $ref: '#/components/schemas/Pagination' }
 *       400:
 *         description: Invalid pagination parameters
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *
 * /quizzes/id/{quizId}:
 *   get:
 *     summary: Get a quiz with its questions
 *     description: Returns one quiz, including its questions, when the caller is allowed to view it.
 *     tags: [Quizzes]
 *     parameters:
 *       - { in: path, name: quizId, required: true, schema: { type: integer, minimum: 1 }, description: Quiz id }
 *     responses:
 *       200:
 *         description: Quiz found.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       required: [quiz]
 *                       properties:
 *                         quiz: { $ref: '#/components/schemas/Quiz' }
 *       403:
 *         description: Caller cannot view this private quiz
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       404:
 *         description: Quiz not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *   patch:
 *     summary: Update a quiz
 *     description: Partially updates a quiz owned by the authenticated user. If questions is sent, the service replaces the quiz question list according to the update implementation.
 *     tags: [Quizzes]
 *     security: [ { cookieAuth: [] } ]
 *     parameters:
 *       - { in: path, name: quizId, required: true, schema: { type: integer, minimum: 1 }, description: Quiz id }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateQuizRequest'
 *     responses:
 *       200:
 *         description: Quiz updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       required: [quiz]
 *                       properties:
 *                         quiz: { $ref: '#/components/schemas/Quiz' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       403:
 *         description: Not the owner
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       404:
 *         description: Quiz not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *   delete:
 *     summary: Soft-delete a quiz
 *     description: Marks a quiz as deleted. The quiz disappears from public listings after cache expiry.
 *     tags: [Quizzes]
 *     security: [ { cookieAuth: [] } ]
 *     parameters:
 *       - { in: path, name: quizId, required: true, schema: { type: integer, minimum: 1 }, description: Quiz id }
 *     responses:
 *       200:
 *         description: Quiz deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       required: [quiz]
 *                       properties:
 *                         quiz: { $ref: '#/components/schemas/Quiz' }
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       403:
 *         description: Not the owner
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       404:
 *         description: Quiz not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
