import { Router } from 'express'
import * as gameController from './game.controller.js'
import { authMiddleware } from '../auth/auth.middleware.js'
import { validateBody } from '../../shared/validators/validator.js'
import { createGameSchema } from './game.schemas.js'
import { optionalAuthMiddleware } from '../../shared/middlewares/optional.auth.js'

export const gameRouter: Router = Router()

/**
 * @swagger
 * /api/v1/games:
 *   post:
 *     summary: Tạo game session mới
 *     tags: [Games]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quiz_id
 *               - session_name
 *             properties:
 *               quiz_id:
 *                 type: number
 *                 minimum: 1
 *                 example: 1
 *               session_name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: My Quiz Game
 *     responses:
 *       201:
 *         description: Tạo game session thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Game created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     session_id:
 *                       type: number
 *                       example: 1
 *                     session_code:
 *                       type: string
 *                       example: 695236
 *                     session_name:
 *                       type: string
 *                       example: My Quiz Game
 *                     quiz_title:
 *                       type: string
 *                       example: Javascript Quiz
 *                     total_questions:
 *                       type: number
 *                       example: 1
 *                     status:
 *                       type: string
 *                       example: waiting
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền tạo game với quiz này
 *       404:
 *         description: Không tìm thấy quiz
 */
gameRouter.post('/', authMiddleware, validateBody(createGameSchema), gameController.createGame)

gameRouter.post('/join/:session_code', optionalAuthMiddleware, gameController.joinGame)

/**
 * @swagger
 * /api/v1/games/player/{player_session_id}/reconnect:
 *   get:
 *     summary: Reconnect vào game session
 *     tags: [Games]
 *     parameters:
 *       - in: path
 *         name: player_session_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của player session
 *         example: 1
 *     responses:
 *       200:
 *         description: Reconnect thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 player_session_id:
 *                   type: number
 *                 player_name:
 *                   type: string
 *                 player_score:
 *                   type: number
 *                 is_host:
 *                   type: boolean
 *                 answered_count:
 *                   type: number
 *                 correct_count:
 *                   type: number
 *                 game_info:
 *                   type: object
 *                   properties:
 *                     session_id:
 *                       type: number
 *                     session_name:
 *                       type: string
 *                     session_status:
 *                       type: string
 *                     total_questions:
 *                       type: number
 *                     total_players:
 *                       type: number
 *                     current_question:
 *                       type: object
 *                       nullable: true
 *                 leaderboard:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Không tìm thấy player session hoặc game đã kết thúc
 */
// gameRouter.get('/player/:player_session_id/reconnect', gameController.reconnect)

/**
 * @swagger
 * /api/v1/games/{session_id}/leaderboard:
 *   get:
 *     summary: Lấy bảng xếp hạng của game session
 *     tags: [Games]
 *     parameters:
 *       - in: path
 *         name: session_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của game session
 *         example: 1
 *     responses:
 *       200:
 *         description: Bảng xếp hạng
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   player_id:
 *                     type: number
 *                   player_name:
 *                     type: string
 *                   player_score:
 *                     type: number
 *                   correct_answers_count:
 *                     type: number
 *                   is_host:
 *                     type: boolean
 *                   rank:
 *                     type: number
 *       404:
 *         description: Không tìm thấy game session
 */
// gameRouter.get('/:session_id/leaderboard', gameController.getLeaderboard)

/**
 * @swagger
 * /api/v1/games/{session_id}:
 *   get:
 *     summary: Lấy thông tin game session
 *     tags: [Games]
 *     parameters:
 *       - in: path
 *         name: session_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID của game session
 *         example: 1
 *     responses:
 *       200:
 *         description: Thông tin game session
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: number
 *                       example: 1
 *                     quiz_snapshot_id:
 *                       type: number
 *                       example: 1
 *                     session_name:
 *                       type: string
 *                       example: My Quiz Game
 *                     session_code:
 *                       type: string
 *                       example: 695236
 *                     session_host:
 *                       type: number
 *                       example: 1
 *                     total_players:
 *                       type: number
 *                       example: 0
 *                     total_questions:
 *                       type: number
 *                       example: 1
 *                     session_status:
 *                       type: string
 *                       enum: [waiting, active, finished]
 *                       example: waiting
 *                     deleted_at:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: 2026-07-17T10:29:24.613Z
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       example: 2026-07-17T10:29:24.613Z
 *                     quiz_id:
 *                       type: number
 *                       example: 2
 *                     quiz_name:
 *                       type: string
 *                       example: Javascript Quiz
 *                     quiz_description:
 *                       type: string
 *                       example: Test your Javascript knowledge
 *       404:
 *         description: Không tìm thấy game session
 */
// gameRouter.get('/:session_id', gameController.getGameSession)
