import type { Response, NextFunction } from 'express'
import type { AuthRequest, User } from '../../shared/types/shared.types.js'
import { GameService } from './game.services.js'
import { pool } from '../../infrastructure/database/connection.js'
import { createGameSchema, joinGameSchema, type CreateGameRequest, type JoinGameRequest } from './game.schemas.js'

export class GameController {
  private gameService: GameService

  constructor() {
    this.gameService = new GameService(pool)
  }

  createGame = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user
      const data: CreateGameRequest = createGameSchema.parse(req.body)

      const result = await this.gameService.createGame(user as User, data)

      res.status(201).json({
        message: 'Game created successfully',
        data: result
      })
    } catch (error) {
      next(error)
    }
  }

  joinGame = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const session_code = req.params.session_code as string

      if (!session_code) {
        res.status(400).json({ message: 'session_code is required' })
        return
      }

      let data: JoinGameRequest
      if (!req.user) {
        data = joinGameSchema.parse(req.body)
        if (!data.player_name) {
          res.status(400).json({ message: 'player_name is required' })
          return
        }
      } else {
        data = {
          player_id: req.user.id,
          player_name: req.user.fullname
        }
      }

      const result = await this.gameService.joinGame(session_code, data)

      res.status(200).json({
        message: 'Joined game session successfully',
        data: result
      })
    } catch (error) {
      next(error)
    }
  }

  startGame = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id
      const sessionId = parseInt(req.params.session_id as string)

      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' })
        return
      }

      if (isNaN(sessionId)) {
        res.status(400).json({ message: 'session_id is invalid' })
        return
      }

      await this.gameService.startGame(sessionId, userId)

      res.status(200).json({
        message: 'Game started successfully'
      })
    } catch (error) {
      next(error)
    }
  }

  getQuestion = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = parseInt(req.params.session_id as string)
      const questionIndex = parseInt(req.query.index as string) || 0

      if (isNaN(sessionId)) {
        res.status(400).json({ message: 'session_id is invalid' })
        return
      }

      const result = await this.gameService.getQuestionForGame(sessionId, questionIndex)

      res.status(200).json({
        data: result
      })
    } catch (error) {
      next(error)
    }
  }

  getLeaderboard = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = parseInt(req.params.session_id as string)

      if (isNaN(sessionId)) {
        res.status(400).json({ message: 'session_id is invalid' })
        return
      }

      const result = await this.gameService.getLeaderboard(sessionId)

      res.status(200).json({
        data: result
      })
    } catch (error) {
      next(error)
    }
  }

  finishGame = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id
      const sessionId = parseInt(req.params.session_id as string)

      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' })
        return
      }

      if (isNaN(sessionId)) {
        res.status(400).json({ message: 'session_id is invalid' })
        return
      }

      const result = await this.gameService.finishGame(sessionId, userId)

      res.status(200).json({
        message: 'Game finished successfully',
        data: result
      })
    } catch (error) {
      next(error)
    }
  }

  getGameSession = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessionId = parseInt(req.params.session_id as string)

      if (isNaN(sessionId)) {
        res.status(400).json({ message: 'session_id is invalid' })
        return
      }

      const result = await this.gameService.getGameSession(sessionId)

      if (!result) {
        res.status(404).json({ message: 'Game session not found' })
        return
      }

      res.status(200).json({
        data: result
      })
    } catch (error) {
      next(error)
    }
  }

  reconnect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const playerSessionId = parseInt(req.params.player_session_id as string)

      if (isNaN(playerSessionId)) {
        res.status(400).json({ message: 'player_session_id is invalid' })
        return
      }

      const result = await this.gameService.reconnect(playerSessionId)

      if (!result) {
        res.status(404).json({ message: 'Player session not found or game ended' })
        return
      }

      res.status(200).json({
        message: 'Reconnected successfully',
        data: result
      })
    } catch (error) {
      next(error)
    }
  }
}
