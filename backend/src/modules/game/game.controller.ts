import type { Response, NextFunction } from 'express'
import type { AuthRequest, User } from '../../shared/types/shared.types.js'
import * as gameService from './game.services.js'
import { createGameSchema, joinGameSchema, type CreateGameRequest, type JoinGameRequest } from './game.schemas.js'

export async function createGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user
    const data: CreateGameRequest = createGameSchema.parse(req.body)

    const result = await gameService.createGame(user as User, data)

    res.status(201).json({
      message: 'Game created successfully',
      data: result
    })
  } catch (error) {
    next(error)
  }
}

export async function joinGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
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

    const result = await gameService.joinGame(session_code, data)

    res.status(200).json({
      message: 'Joined game session successfully',
      data: result
    })
  } catch (error) {
    next(error)
  }
}

export async function startGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
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

    await gameService.startGame(sessionId, userId)

    res.status(200).json({
      message: 'Game started successfully'
    })
  } catch (error) {
    next(error)
  }
}

export async function getQuestion(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionId = parseInt(req.params.session_id as string)
    const questionIndex = parseInt(req.query.index as string) || 0

    if (isNaN(sessionId)) {
      res.status(400).json({ message: 'session_id is invalid' })
      return
    }

    const result = await gameService.getQuestionForGame(sessionId, questionIndex)

    res.status(200).json({
      data: result
    })
  } catch (error) {
    next(error)
  }
}

// export async function getLeaderboard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
//   try {
//     const sessionId = parseInt(req.params.session_id as string)

//     if (isNaN(sessionId)) {
//       res.status(400).json({ message: 'session_id is invalid' })
//       return
//     }

//     const result = await gameService.getLeaderboard(sessionId)

//     res.status(200).json({
//       data: result
//     })
//   } catch (error) {
//     next(error)
//   }
// }

// export async function finishGame(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
//   try {
//     const userId = req.user?.id
//     const sessionId = parseInt(req.params.session_id as string)

//     if (!userId) {
//       res.status(401).json({ message: 'Unauthorized' })
//       return
//     }

//     if (isNaN(sessionId)) {
//       res.status(400).json({ message: 'session_id is invalid' })
//       return
//     }

//     const result = await gameService.finishGame(sessionId, userId)

//     res.status(200).json({
//       message: 'Game finished successfully',
//       data: result
//     })
//   } catch (error) {
//     next(error)
//   }
// }

// export async function getGameSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
//   try {
//     const sessionId = parseInt(req.params.session_id as string)

//     if (isNaN(sessionId)) {
//       res.status(400).json({ message: 'session_id is invalid' })
//       return
//     }

//     const result = await gameService.getGameSession(sessionId)

//     if (!result) {
//       res.status(404).json({ message: 'Game session not found' })
//       return
//     }

//     res.status(200).json({
//       data: result
//     })
//   } catch (error) {
//     next(error)
//   }
// }

// export async function reconnect(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
//   try {
//     const playerSessionId = parseInt(req.params.player_session_id as string)

//     if (isNaN(playerSessionId)) {
//       res.status(400).json({ message: 'player_session_id is invalid' })
//       return
//     }

//     const result = await gameService.reconnect(playerSessionId)

//     if (!result) {
//       res.status(404).json({ message: 'Player session not found or game ended' })
//       return
//     }

//     res.status(200).json({
//       message: 'Reconnected successfully',
//       data: result
//     })
//   } catch (error) {
//     next(error)
//   }
// }
