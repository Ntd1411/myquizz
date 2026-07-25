import { Router } from 'express'
import * as controller from './game.controller.js'
import { authMiddleware } from '../auth/auth.middleware.js'
import { optionalAuthMiddleware } from '../../shared/middlewares/optional.auth.js'

const router = Router()

/**
 * @openapi
 * tags:
 *   - name: Game
 *     description: Game session lifecycle - modes, creation, lobby, config, join and results
 *
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     GameMode:
 *       type: string
 *       enum: [classic, solo, team, survival, marathon, practice]
 *       default: classic
 *     GameConfig:
 *       type: object
 *       description: >
 *         Full game configuration. Every field has a default value, so the client only sends
 *         the options it wants to override. The merged object is stored in game_sessions.config.
 *       properties:
 *         version:
 *           type: integer
 *           enum: [1]
 *           default: 1
 *         scoring:
 *           type: object
 *           properties:
 *             basePoints: { type: integer, default: 1000 }
 *             speedBonus:
 *               type: boolean
 *               default: true
 *               description: Award up to 50% of basePoints based on how fast the answer arrives
 *             streak:
 *               type: object
 *               properties:
 *                 enabled: { type: boolean, default: false }
 *                 bonusPerStep: { type: integer, default: 100 }
 *                 max: { type: integer, default: 500 }
 *             negativeMarking:
 *               type: boolean
 *               default: false
 *               description: Subtract 25% of basePoints on a wrong answer
 *         timing:
 *           type: object
 *           properties:
 *             perQuestionSeconds:
 *               type: integer
 *               nullable: true
 *               default: null
 *               description: Null falls back to the time_limit stored on each question
 *             autoAdvance: { type: boolean, default: true }
 *             showResultsSeconds: { type: integer, default: 5 }
 *             totalMatchSeconds:
 *               type: integer
 *               nullable: true
 *               default: null
 *               description: Whole match time budget, required by the marathon mode (min 30)
 *         lobby:
 *           type: object
 *           properties:
 *             maxPlayers: { type: integer, default: 100 }
 *             allowLateJoin: { type: boolean, default: false }
 *             allowGuests: { type: boolean, default: true }
 *         flow:
 *           type: object
 *           properties:
 *             pacing:
 *               type: string
 *               enum: [host, self]
 *               default: host
 *               description: host = everyone answers the same question, self = each player runs alone
 *             allowAnswerChange: { type: boolean, default: false }
 *             showCorrectAnswer: { type: boolean, default: true }
 *             showLeaderboard:
 *               type: string
 *               enum: [never, between_questions, end_only]
 *               default: between_questions
 *             lives:
 *               type: integer
 *               nullable: true
 *               default: null
 *               description: Lives per player, required by the survival mode (min 1)
 *     GameSession:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 12 }
 *         quiz_snapshot_id: { type: integer, example: 8 }
 *         session_name: { type: string, example: Friday quiz night }
 *         session_code:
 *           type: string
 *           example: K7QM2B
 *           description: 6 character code used to join the room and to name the socket room
 *         session_host: { type: integer, example: 3 }
 *         total_players: { type: integer, example: 0 }
 *         total_questions: { type: integer, example: 15 }
 *         session_status:
 *           type: string
 *           enum: [lobby, active, paused, finished, cancelled]
 *         game_mode: { $ref: '#/components/schemas/GameMode' }
 *         config: { $ref: '#/components/schemas/GameConfig' }
 *         current_question_index: { type: integer, example: 0 }
 *         current_phase:
 *           type: string
 *           enum: [lobby, question_active, question_locked, showing_results]
 *         phase_ends_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Server side deadline of the current phase, used for timers and reconnect
 *     PlayerSession:
 *       type: object
 *       properties:
 *         id: { type: integer, example: 41 }
 *         game_session_id: { type: integer, example: 12 }
 *         player_id: { type: integer, nullable: true, example: 3 }
 *         player_guest_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: Set for guests only, generated and stored by the client
 *         player_name: { type: string, example: Dung }
 *         player_score: { type: integer, example: 0 }
 *         correct_answers_count: { type: integer, example: 0 }
 *         streak: { type: integer, example: 0 }
 *         lives: { type: integer, nullable: true, example: 3 }
 *         current_question_index: { type: integer, example: 0 }
 *         status:
 *           type: string
 *           enum: [connected, disconnected, eliminated, finished]
 *     LobbyPlayer:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         player_name: { type: string }
 *         player_score: { type: integer }
 *         status: { type: string }
 *     LeaderboardEntry:
 *       type: object
 *       properties:
 *         rank: { type: integer, example: 1 }
 *         id: { type: integer, example: 41 }
 *         player_name: { type: string, example: Dung }
 *         player_score: { type: integer, example: 2480 }
 *         correct_answers_count: { type: integer, example: 3 }
 *         streak: { type: integer, example: 2 }
 *         status: { type: string, example: connected }
 *     QuestionStat:
 *       type: object
 *       properties:
 *         question_id: { type: integer, example: 77 }
 *         answer_count: { type: integer, example: 10 }
 *         correct_count: { type: integer, example: 6 }
 *   responses:
 *     BadRequest:
 *       description: Invalid payload (Zod validation) or unsupported game mode
 *     Unauthorized:
 *       description: Missing or invalid access token
 *     Forbidden:
 *       description: Caller is not the host, or the room does not allow guests
 *     NotFound:
 *       description: Room not found
 *     Conflict:
 *       description: Room is full, already started, or not in lobby anymore
 */

/**
 * @openapi
 * /api/v1/games/game-modes:
 *   get:
 *     tags: [Game]
 *     summary: List every registered game mode with its default config
 *     description: >
 *       Returns the modes registered in the engine registry together with the config object each
 *       mode starts from. The client uses this to render the create game form dynamically.
 *     responses:
 *       200:
 *         description: List of modes
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
 *                       mode: { $ref: '#/components/schemas/GameMode' }
 *                       defaultConfig: { $ref: '#/components/schemas/GameConfig' }
 */
router.get('/game-modes', controller.listGameModes) // Get available game modes

/**
 * @openapi
 * /api/v1/games:
 *   post:
 *     tags: [Game]
 *     summary: Create a game session
 *     description: >
 *       Snapshots the quiz, merges the mode default config with the client override, validates it
 *       with the mode handler, then stores the session and warms the Redis cache.
 *       The session code is generated server side and returned in the response.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quiz_id, session_name]
 *             properties:
 *               quiz_id: { type: integer, minimum: 1, example: 8 }
 *               session_name: { type: string, minLength: 2, maxLength: 100, example: Friday quiz night }
 *               mode: { $ref: '#/components/schemas/GameMode' }
 *               config:
 *                 allOf:
 *                   - $ref: '#/components/schemas/GameConfig'
 *                 description: Partial override, only the fields the host wants to change
 *           examples:
 *             classic:
 *               summary: Classic room with streak bonus
 *               value:
 *                 quiz_id: 8
 *                 session_name: Friday quiz night
 *                 mode: classic
 *                 config:
 *                   scoring: { streak: { enabled: true } }
 *                   timing: { perQuestionSeconds: 20 }
 *             survival:
 *               summary: Survival room with 5 lives
 *               value:
 *                 quiz_id: 8
 *                 session_name: Last one standing
 *                 mode: survival
 *                 config:
 *                   flow: { lives: 5 }
 *     responses:
 *       201:
 *         description: Session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/GameSession' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/', authMiddleware, controller.createGame) // Create a new game

/**
 * @openapi
 * /api/v1/games/{code}:
 *   get:
 *     tags: [Game]
 *     summary: Get lobby state by session code
 *     description: >
 *       Public endpoint used by the join screen. Reads from Redis first and falls back to Postgres.
 *       Correct answers are never exposed here.
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string, example: K7QM2B }
 *     responses:
 *       200:
 *         description: Lobby snapshot
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     session: { $ref: '#/components/schemas/GameSession' }
 *                     players:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/LobbyPlayer' }
 *                     config: { $ref: '#/components/schemas/GameConfig' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:code', controller.getGameByCode) // Get game by code

/**
 * @openapi
 * /api/v1/games/{id}/config:
 *   patch:
 *     tags: [Game]
 *     summary: Update the game config (host only, lobby only)
 *     description: >
 *       Deep merges the patch into the current config, re-validates it with the mode handler,
 *       writes it to Postgres and refreshes the cache write through.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 12 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [config]
 *             properties:
 *               config: { $ref: '#/components/schemas/GameConfig' }
 *           example:
 *             config:
 *               timing: { perQuestionSeconds: 30, showResultsSeconds: 8 }
 *               lobby: { maxPlayers: 50 }
 *     responses:
 *       200:
 *         description: Updated session
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/GameSession' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 */
router.patch('/:id/config', authMiddleware, controller.updateGameConfig) // Update game config

/**
 * @openapi
 * /api/v1/games/{id}/host-token:
 *   post:
 *     tags: [Game]
 *     summary: Issue a short lived socket token for the host
 *     description: >
 *       The host calls this before opening the socket connection, and again after a page reload.
 *       The token is signed with SOCKET_JWT_SECRET and carries the room, the role and the TTL.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 12 }
 *     responses:
 *       200:
 *         description: Socket token issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     socketToken: { type: string, example: eyJhbGciOiJIUzI1NiJ9... }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.post('/:id/host-token', authMiddleware, controller.getHostToken) // Host socket token

/**
 * @openapi
 * /api/v1/games/{code}/join:
 *   post:
 *     tags: [Game]
 *     summary: Join a room as a logged in user or as a guest
 *     description: >
 *       Auth is optional. When an access token is present the server takes the identity from the
 *       token and ignores the body. When it is absent the client must send player_name and a
 *       client generated player_guest_id. Returns the player session plus the socket token.
 *     security:
 *       - bearerAuth: []
 *       - {}
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string, example: K7QM2B }
 *     requestBody:
 *       description: Required for guests only, ignored when the caller is authenticated
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [player_name, player_guest_id]
 *             properties:
 *               player_name: { type: string, minLength: 1, maxLength: 50, example: Guest 01 }
 *               player_guest_id: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Joined
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     player: { $ref: '#/components/schemas/PlayerSession' }
 *                     socketToken: { type: string }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 */
router.post('/:code/join', optionalAuthMiddleware, controller.joinGame) // Join game

/**
 * @openapi
 * /api/v1/games/{id}/leaderboard:
 *   get:
 *     tags: [Game]
 *     summary: Get the live leaderboard
 *     description: Served from the Redis sorted set while the game runs, falls back to Postgres.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 12 }
 *     responses:
 *       200:
 *         description: Ranked players
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/LeaderboardEntry' }
 */
router.get('/:id/leaderboard', controller.getLeaderboard) // Get leaderboard

/**
 * @openapi
 * /api/v1/games/{id}/results:
 *   get:
 *     tags: [Game]
 *     summary: Get the final results and the per question breakdown
 *     description: Final numbers are always read from Postgres, which is the source of truth.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, example: 12 }
 *     responses:
 *       200:
 *         description: Full results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     session: { $ref: '#/components/schemas/GameSession' }
 *                     leaderboard:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/LeaderboardEntry' }
 *                     perQuestion:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/QuestionStat' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/:id/results', controller.getResults) // Get results

export default router
