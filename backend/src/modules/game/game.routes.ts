import { Router } from 'express'
import * as controller from './game.controller.js'
import { authMiddleware } from '../auth/auth.middleware.js'
import { optionalAuthMiddleware } from '../../shared/middlewares/optional.auth.js'

const router = Router()

router.get('/game-modes', controller.listGameModes) // get list game mode
router.post('/games', authMiddleware, controller.createGame) // create game
router.get('/games/:code', controller.getGameByCode) // get game by code
router.patch('/games/:id/config', authMiddleware, controller.updateGameConfig) // update game config
router.post('/games/:id/host-token', authMiddleware, controller.getHostToken) // host socket token
router.post('/games/:code/join', optionalAuthMiddleware, controller.joinGame) // join game
router.get('/games/:id/leaderboard', controller.getLeaderboard) // get leaderboard
router.get('/games/:id/results', controller.getResults) // get results

export default router
