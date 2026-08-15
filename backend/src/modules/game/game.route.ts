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

router.get('/:id/review', controller.getReview) // Player's own answer sheet (socket token)

export default router
