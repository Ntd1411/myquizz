/* eslint-disable max-len */
import { Router } from 'express'
import { authMiddleware } from '../auth/auth.middleware.js'
import * as quizController from './quiz.controller.js'
import * as listingController from './listing.controller.js'
import {
  validateBody,
  validateParams,
  validateQuery
} from '../../shared/validators/validator.js'
import {
  createQuizSchema,
  feedQuerySchema,
  myQuizzesQuerySchema,
  ownerIdParamSchema,
  ownerQuizzesQuerySchema,
  searchQuizzesSchema,
  updateQuizSchema
} from './quiz.schema.js'
import { optionalAuthMiddleware } from '../../shared/middlewares/optional.auth.js'
import * as homeController from './home.controller.js'

export const quizRouter: Router = Router()

quizRouter.post( '/', authMiddleware, validateBody(createQuizSchema), quizController.createQuiz)

// Declaration order matters: every literal path is registered before any route
// with a dynamic segment, so a static route can never be swallowed by a pattern.
quizRouter.get('/search', optionalAuthMiddleware, validateQuery(searchQuizzesSchema), listingController.searchQuizzes)

quizRouter.get('/me', authMiddleware, validateQuery(myQuizzesQuerySchema), listingController.getMyQuizzes)

quizRouter.get('/home', optionalAuthMiddleware, homeController.getHome)

quizRouter.get('/feed', optionalAuthMiddleware, validateQuery(feedQuerySchema), homeController.getFeed)

// No auth middleware at all: a public profile returns the same rows to everyone,
// including the owner, who uses GET /quizzes/me to manage their own quizzes.
quizRouter.get('/users/id/:ownerId', validateParams(ownerIdParamSchema), validateQuery(ownerQuizzesQuerySchema), listingController.getQuizzesByOwner)

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
 * components:
 *   schemas:
 *     QuizSummary:
 *       type: object
 *       description: Row shape returned by the listing endpoints (search, public profile, /quizzes/me). Questions are never included here.
 *       properties:
 *         id: { type: integer, example: 42 }
 *         quiz_owner: { type: integer, example: 3 }
 *         quiz_name: { type: string, example: JavaScript Basics }
 *         quiz_description: { type: string, nullable: true }
 *         quiz_image: { type: string, nullable: true }
 *         quiz_category: { type: string, nullable: true, example: Programming }
 *         quiz_language: { type: string, example: en }
 *         is_public: { type: boolean, example: true }
 *         question_count: { type: integer, example: 8 }
 *         play_count: { type: integer, example: 120 }
 *         completion_rate: { type: number, format: float, minimum: 0, maximum: 1, example: 0.66 }
 *         created_at: { type: string, format: date-time }
 *         updated_at: { type: string, format: date-time }
 *     ListingPagination:
 *       type: object
 *       description: Cursor paging state of the listing endpoints. total is present only when the request asked for it with include_total=true.
 *       properties:
 *         limit: { type: integer, example: 12 }
 *         nextCursor:
 *           type: string
 *           nullable: true
 *           description: Pass this back as cursor to fetch the next page. null means the last page was reached.
 *           example: djF8bmV3ZXN0fGExYjJjM2Q0fE1qQXlOaTB3T0Mwd09BfDQy
 *         hasMore: { type: boolean, example: true }
 *         total: { type: integer, example: 137 }
 *
 * /quizzes/search:
 *   get:
 *     summary: Search quizzes
 *     description: |
 *       Cursor-paginated search over the quiz catalogue.
 *       Authentication is optional and is read from the accessToken cookie, which the browser sends
 *       automatically once you have called POST /auth/login from this page. Anonymous callers only see
 *       quizzes that are public, not deleted, and have at least one question; a signed-in caller sees the
 *       same rows plus their own private and still empty quizzes.
 *       sort has no default: relevance is used when keyword is present, newest otherwise, and relevance
 *       without a keyword falls back to newest.
 *       A cursor is bound to the sort and to the whole filter set that produced it, so changing keyword,
 *       language, category, a date bound, min_questions, min_plays, owner_id, mine, or sort makes the old
 *       cursor a 400 instead of silently returning a page from another result set. limit is not part of
 *       that binding and may change between pages.
 *     tags: [Quizzes]
 *     security: [ {}, { cookieAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: keyword
 *         description: Free text matched against quiz name and description.
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
 *         schema: { type: string, maxLength: 100 }
 *         example: Programming
 *       - in: query
 *         name: created_from
 *         description: Inclusive lower bound on created_at, widened to the start of that day.
 *         schema: { type: string, format: date, pattern: '^\d{4}-\d{2}-\d{2}$' }
 *         example: '2026-01-01'
 *       - in: query
 *         name: created_to
 *         description: Inclusive upper bound on created_at, widened to the end of that day. Must not be earlier than created_from.
 *         schema: { type: string, format: date, pattern: '^\d{4}-\d{2}-\d{2}$' }
 *         example: '2026-12-31'
 *       - in: query
 *         name: min_questions
 *         description: Keep only quizzes with at least this many questions.
 *         schema: { type: integer, minimum: 0 }
 *         example: 5
 *       - in: query
 *         name: min_plays
 *         description: Keep only quizzes played at least this many times.
 *         schema: { type: integer, minimum: 0 }
 *         example: 10
 *       - in: query
 *         name: owner_id
 *         description: Restrict the search to one owner. Visibility rules still apply, so an outsider sees only that owner's public quizzes.
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: mine
 *         description: Restrict the search to the signed-in user's own quizzes, private ones included. Requires the accessToken cookie; sending it while anonymous is a 400.
 *         schema: { type: string, enum: ['true', 'false'], default: 'false' }
 *       - in: query
 *         name: sort
 *         description: Ordering. Defaults to relevance with a keyword and newest without one.
 *         schema: { type: string, enum: [relevance, newest, oldest, name_asc, name_desc, most_played, trending] }
 *       - in: query
 *         name: cursor
 *         description: Opaque cursor copied from the previous response's meta.pagination.nextCursor.
 *         schema: { type: string, minLength: 1, maxLength: 300 }
 *       - in: query
 *         name: limit
 *         description: Number of quizzes to return.
 *         schema: { type: integer, minimum: 1, maximum: 24, default: 12 }
 *       - in: query
 *         name: include_total
 *         description: When true, adds meta.pagination.total. It costs an extra COUNT query, so request it only for the first page.
 *         schema: { type: string, enum: ['true', 'false'], default: 'false' }
 *     responses:
 *       200:
 *         description: Matching quizzes under data.quizzes; cursor state under meta.pagination.
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
 *                           items: { $ref: '#/components/schemas/QuizSummary' }
 *                     meta:
 *                       allOf:
 *                         - $ref: '#/components/schemas/ApiMeta'
 *                         - type: object
 *                           properties:
 *                             pagination: { $ref: '#/components/schemas/ListingPagination' }
 *             examples:
 *               firstPage:
 *                 summary: First page of an anonymous keyword search
 *                 value:
 *                   success: true
 *                   data:
 *                     quizzes:
 *                       - id: 10
 *                         quiz_owner: 3
 *                         quiz_name: JavaScript Basics
 *                         quiz_description: Quick warm-up questions
 *                         quiz_image: https://cdn.example.com/js.png
 *                         quiz_category: Programming
 *                         quiz_language: en
 *                         is_public: true
 *                         question_count: 8
 *                         play_count: 120
 *                         completion_rate: 0.66
 *                         created_at: '2026-08-01T10:00:00.000Z'
 *                         updated_at: '2026-08-02T09:00:00.000Z'
 *                   error: null
 *                   meta:
 *                     timestamp: '2026-08-08T15:00:00.000Z'
 *                     pagination:
 *                       limit: 12
 *                       nextCursor: djF8cmVsZXZhbmNlfGExYjJjM2Q0fE1DNDU0fDEw
 *                       hasMore: true
 *       400:
 *         description: Invalid query parameter, inverted date range, mine=true without a session, or a cursor that does not match the current sort and filters
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *
 * /quizzes/me:
 *   get:
 *     summary: List the signed-in user's own quizzes
 *     description: |
 *       Cursor-paginated listing of everything the caller owns, private and still empty quizzes included.
 *       Authentication is required and comes from the accessToken cookie, so call POST /auth/login first;
 *       there is no Authorize button to fill in because the cookie is HTTP-only and set by the server.
 *       This is the management view of the owner's library, as opposed to GET /quizzes/users/id/{ownerId},
 *       which is the public profile and hides private or empty quizzes even from the owner.
 *     tags: [Quizzes]
 *     security: [ { cookieAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: visibility
 *         description: Filter by publication state.
 *         schema: { type: string, enum: [all, public, private], default: all }
 *       - in: query
 *         name: keyword
 *         description: Free text matched against the caller's own quiz name and description.
 *         schema: { type: string, maxLength: 200 }
 *       - in: query
 *         name: sort
 *         description: Ordering of the caller's library.
 *         schema: { type: string, enum: [recently_updated, newest, oldest, name_asc], default: recently_updated }
 *       - in: query
 *         name: cursor
 *         description: Opaque cursor copied from the previous response's meta.pagination.nextCursor. It is bound to sort, visibility, and keyword.
 *         schema: { type: string, minLength: 1, maxLength: 300 }
 *       - in: query
 *         name: limit
 *         description: Number of quizzes to return.
 *         schema: { type: integer, minimum: 1, maximum: 24, default: 12 }
 *       - in: query
 *         name: include_total
 *         description: When true, adds meta.pagination.total. It costs an extra COUNT query, so request it only for the first page.
 *         schema: { type: string, enum: ['true', 'false'], default: 'false' }
 *     responses:
 *       200:
 *         description: The caller's quizzes under data.quizzes; cursor state under meta.pagination.
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
 *                           items: { $ref: '#/components/schemas/QuizSummary' }
 *                     meta:
 *                       allOf:
 *                         - $ref: '#/components/schemas/ApiMeta'
 *                         - type: object
 *                           properties:
 *                             pagination: { $ref: '#/components/schemas/ListingPagination' }
 *       400:
 *         description: Invalid query parameter or a cursor that does not match the current sort and filters
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       401:
 *         description: Access token cookie missing, blacklisted, or invalid
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       403:
 *         description: Account is deactivated
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
 *     summary: List one user's public quizzes (public profile)
 *     description: |
 *       Public profile listing with cursor pagination. It returns exactly the same rows to everybody,
 *       including the owner: only quizzes that are public, not deleted, and have at least one question.
 *       The endpoint runs no authentication at all, so sending the accessToken cookie changes nothing;
 *       owners manage their own quizzes through GET /quizzes/me instead.
 *       An unknown or deactivated owner is a 404, which is different from a real owner with nothing
 *       public yet: that is a 200 with an empty quizzes array.
 *     tags: [Quizzes]
 *     parameters:
 *       - { in: path, name: ownerId, required: true, schema: { type: integer, minimum: 1 }, description: Owner user id }
 *       - in: query
 *         name: sort
 *         description: Ordering of the profile listing.
 *         schema: { type: string, enum: [newest, oldest, most_played, name_asc], default: newest }
 *       - in: query
 *         name: cursor
 *         description: Opaque cursor copied from the previous response's meta.pagination.nextCursor. It is bound to the sort it was issued for, so changing sort invalidates it.
 *         schema: { type: string, minLength: 1, maxLength: 300 }
 *       - in: query
 *         name: limit
 *         description: Number of quizzes to return.
 *         schema: { type: integer, minimum: 1, maximum: 24, default: 12 }
 *       - in: query
 *         name: include_total
 *         description: When true, adds meta.pagination.total. It costs an extra COUNT query, so request it only for the first page.
 *         schema: { type: string, enum: ['true', 'false'], default: 'false' }
 *     responses:
 *       200:
 *         description: Public quizzes of that owner under data.quizzes; cursor state under meta.pagination.
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
 *                           items: { $ref: '#/components/schemas/QuizSummary' }
 *                     meta:
 *                       allOf:
 *                         - $ref: '#/components/schemas/ApiMeta'
 *                         - type: object
 *                           properties:
 *                             pagination: { $ref: '#/components/schemas/ListingPagination' }
 *             examples:
 *               emptyProfile:
 *                 summary: Existing user with no public quiz yet
 *                 value:
 *                   success: true
 *                   data: { quizzes: [] }
 *                   error: null
 *                   meta:
 *                     timestamp: '2026-08-08T15:00:00.000Z'
 *                     pagination: { limit: 12, nextCursor: null, hasMore: false }
 *       400:
 *         description: ownerId is not a positive integer, a query parameter is invalid, or the cursor does not match the requested sort
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       404:
 *         description: Owner does not exist or the account is deactivated
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
