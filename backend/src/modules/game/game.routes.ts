import { Router } from 'express'
import { GameController } from './game.controller.js'
import { authMiddleware } from '../auth/auth.middleware.js'
import { optionalAuthMiddleware } from '../../shared/middlewares/optional.auth.js'
import { validateBody } from '../../shared/validators/validator.js'
import { createGameSchema, joinGameSchema } from './game.schemas.js'

export const gameRouter = Router()
const gameController = new GameController()

gameRouter.post('/', authMiddleware, validateBody(createGameSchema), gameController.createGame)
gameRouter.post('/:session_id/start', authMiddleware, gameController.startGame)
gameRouter.post('/:session_id/finish', authMiddleware, gameController.finishGame)
gameRouter.post('/:session_code/join', optionalAuthMiddleware, validateBody(joinGameSchema), gameController.joinGame)
gameRouter.get('/player/:player_session_id/reconnect', gameController.reconnect)
gameRouter.get('/:session_id/question', gameController.getQuestion)
gameRouter.get('/:session_id/leaderboard', gameController.getLeaderboard)
gameRouter.get('/:session_id', gameController.getGameSession)
