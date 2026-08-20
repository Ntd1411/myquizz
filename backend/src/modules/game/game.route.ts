import { Router } from 'express'
import * as controller from './game.controller.js'
import { authMiddleware } from '../auth/auth.middleware.js'
import { optionalAuthMiddleware } from '../../shared/middlewares/optional.auth.js'
import { validateParams, validateQuery } from '../../shared/validators/validator.js'
import { gameIdParamSchema, historyQuerySchema } from './game.schema.js'

const router: Router = Router()

router.get('/game-modes', controller.listGameModes) // Get available game modes

// Declared before GET /:code, or Express reads 'history' as a room code.
// Optional auth on purpose: a guest's played history is tied to the UUID in their
// browser, sent as x-guest-id, so the endpoint has to answer without a cookie too.
router.get('/history', optionalAuthMiddleware, validateQuery(historyQuerySchema), controller.getHistory) // Played / hosted history

router.post('/', authMiddleware, controller.createGame) // Create a new game

router.get('/:code', controller.getGameByCode) // Get game by code

router.patch('/:id/config', authMiddleware, controller.updateGameConfig) // Update game config

router.post('/:id/host-token', authMiddleware, controller.getHostToken) // Host socket token

router.post('/:code/join', optionalAuthMiddleware, controller.joinGame) // Join game

router.get('/:id/leaderboard', controller.getLeaderboard) // Get leaderboard

router.get('/:id/results', controller.getResults) // Get results

router.get('/:id/review', controller.getReview) // Player's own answer sheet (socket token)

// History detail. Same answer sheet as /:id/review, but authenticated by cookie or
// guest id instead of the socket token, which does not survive the tab that played.
router.get('/:id/summary', optionalAuthMiddleware, validateParams(gameIdParamSchema), controller.getHistorySummary) // Past match overview

router.get('/:id/my-answers', optionalAuthMiddleware, validateParams(gameIdParamSchema), controller.getMyAnswers) // Own answers of a past match

export default router
