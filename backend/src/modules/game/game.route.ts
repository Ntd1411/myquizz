/* eslint-disable max-len */
import { Router } from 'express'
import * as controller from './game.controller.js'
import { authMiddleware } from '../auth/auth.middleware.js'
import { optionalAuthMiddleware } from '../../shared/middlewares/optional.auth.js'

const router: Router = Router()

router.get('/game-modes', controller.listGameModes) // Get available game modes

router.post('/', authMiddleware, controller.createGame) // Create a new game

router.get('/:code', controller.getGameByCode) // Get game by code

router.patch('/:id/config', authMiddleware, controller.updateGameConfig) // Update game config

router.post('/:id/host-token', authMiddleware, controller.getHostToken) // Host socket token

router.post('/:code/join', optionalAuthMiddleware, controller.joinGame) // Join game

router.get('/:id/leaderboard', controller.getLeaderboard) // Get leaderboard

router.get('/:id/results', controller.getResults) // Get results

export default router

/**
 * @openapi
 * tags:
 *   - name: Game
 *     description: Game session lifecycle (modes, creation, lobby, config, join, results)
 *
 * /games/game-modes:
 *   get:
 *     summary: List registered modes with default config and editable/locked field specs
 *     tags: [Game]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         gameModes: { type: array, items: { $ref: '#/components/schemas/ModeConfigDescriptor' } }
 *
 * /games:
 *   post:
 *     summary: Create a game session (host)
 *     description: Response nests the session under data.data.session; dropped config fields are under data.ignored.
 *     tags: [Game]
 *     security: [ { cookieAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quiz_id, session_name]
 *             properties:
 *               quiz_id: { type: integer, minimum: 1 }
 *               session_name: { type: string, minLength: 2, maxLength: 100 }
 *               mode: { $ref: '#/components/schemas/GameMode' }
 *               config: { $ref: '#/components/schemas/GameConfig' }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         data: { type: object, properties: { session: { $ref: '#/components/schemas/GameSession' } } }
 *                         ignored:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               path: { type: string }
 *                               value: {}
 *                               reason: { type: string, enum: [unknown, locked, invalid] }
 *       400: { description: Invalid payload or unsupported mode }
 *       401: { description: Not authenticated }
 *
 * /games/{code}:
 *   get:
 *     summary: Get lobby state by session code (public; answers never exposed)
 *     description: data.session = { session, players, config }
 *     tags: [Game]
 *     parameters:
 *       - { in: path, name: code, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         session:
 *                           type: object
 *                           properties:
 *                             session: { $ref: '#/components/schemas/GameSession' }
 *                             players: { type: array, items: { $ref: '#/components/schemas/LobbyPlayer' } }
 *                             config: { $ref: '#/components/schemas/GameConfig' }
 *       404: { description: Room not found }
 *
 * /games/{id}/config:
 *   patch:
 *     summary: Update the game config (host only, lobby only)
 *     tags: [Game]
 *     security: [ { cookieAuth: [] } ]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [config]
 *             properties:
 *               config: { $ref: '#/components/schemas/GameConfig' }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         config: { $ref: '#/components/schemas/GameConfig' }
 *                         changed: { type: boolean }
 *                         ignored: { type: array, items: { type: object } }
 *       403: { description: Not the host }
 *       404: { description: Room not found }
 *       409: { description: Not in lobby anymore }
 *
 * /games/{id}/host-token:
 *   post:
 *     summary: Issue a socket token for the host
 *     description: Token nested under data.hostToken.socketToken
 *     tags: [Game]
 *     security: [ { cookieAuth: [] } ]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         hostToken: { type: object, properties: { socketToken: { type: string } } }
 *       403: { description: Not the host }
 *       404: { description: Room not found }
 *
 * /games/{code}/join:
 *   post:
 *     summary: Join a room as a logged-in user or a guest
 *     description: Optional auth. With an access-token cookie the identity comes from the token and the body is ignored; otherwise the client must send player_name and player_guest_id.
 *     tags: [Game]
 *     security: [ { cookieAuth: [] }, {} ]
 *     parameters:
 *       - { in: path, name: code, required: true, schema: { type: string } }
 *     requestBody:
 *       description: Required for guests only
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [player_name, player_guest_id]
 *             properties:
 *               player_name: { type: string, minLength: 1, maxLength: 50 }
 *               player_guest_id: { type: string, format: uuid }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         player: { $ref: '#/components/schemas/PlayerSession' }
 *                         socketToken: { type: string }
 *       403: { description: Guests not allowed, or host cannot join }
 *       404: { description: Room not found }
 *       409: { description: Room full or already started }
 *
 * /games/{id}/leaderboard:
 *   get:
 *     summary: Get the live leaderboard
 *     tags: [Game]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object, properties: { leaderboard: { type: array, items: { $ref: '#/components/schemas/LeaderboardEntry' } } } }
 *
 * /games/{id}/results:
 *   get:
 *     summary: Get final results and the per-question breakdown
 *     description: data.results = { session, leaderboard, perQuestion }
 *     tags: [Game]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         results:
 *                           type: object
 *                           properties:
 *                             session: { $ref: '#/components/schemas/GameSession' }
 *                             leaderboard: { type: array, items: { $ref: '#/components/schemas/LeaderboardEntry' } }
 *                             perQuestion: { type: array, items: { $ref: '#/components/schemas/QuestionStat' } }
 *       404: { description: Room not found }
 */
