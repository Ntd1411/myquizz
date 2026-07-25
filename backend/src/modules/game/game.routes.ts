import { Router } from 'express'
import * as controller from './game.controller.js'
import { authMiddleware } from '../auth/auth.middleware.js'
import { optionalAuthMiddleware } from '../../shared/middlewares/optional.auth.js'

const router = Router()

router.get('/game-modes', controller.listGameModes) // Get available game modes
router.post('/games', authMiddleware, controller.createGame) // Create a new game
router.get('/games/:code', controller.getGameByCode) // Get game by code
router.patch('/games/:id/config', authMiddleware, controller.updateGameConfig) // Update game config
router.post('/games/:id/host-token', authMiddleware, controller.getHostToken) // Host socket token
router.post('/games/:code/join', optionalAuthMiddleware, controller.joinGame) // Join game
router.get('/games/:id/leaderboard', controller.getLeaderboard) // Get leaderboard
router.get('/games/:id/results', controller.getResults) // Get results

export default router
