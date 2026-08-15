import type { Response, NextFunction } from 'express'
import { createGameSchema, joinGameSchema, updateConfigSchema, type JoinGameInput } from './game.schema.js'
import * as gameService from './game.service.js'
import { AppError } from '../../shared/errors/AppError.js'
import type { AuthRequest } from '../auth/auth.type.js'
import { success } from '../../shared/utils/response.js'

export const listGameModes = (_req: AuthRequest, res: Response) =>
  success(res, { gameModes: gameService.listGameModes() })

export const createGame = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized')
    const input = createGameSchema.parse(req.body)
    const { session, ignored } = await gameService.createGame(input, req.user.id)
    return success(res, { data: { session }, ignored }, 201)
  } catch (e) {
    next(e)
  }
}

export const getGameByCode = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const code = req.params['code'] as string
    if (!code) {
      throw new AppError(400, 'Missing code')
    }
    const session = await gameService.getLobby(code)
    return success(res, { session })
  } catch (e) {
    next(e)
  }
}

export const updateGameConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized')
    if (Number.isInteger(req.params['id']) === false) {
      throw new AppError(400, 'Invalid game ID')
    }
    const { config } = updateConfigSchema.parse(req.body)
    const { session, ignored, changed } = await gameService.updateGameConfig(
      Number(req.params['id']),
      req.user.id,
      config
    )
    return success(res, { config: session.config, changed, ignored })
  } catch (e) {
    next(e)
  }
}

export const joinGame = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const code = req.params['code'] as string
    if (!code) {
      throw new AppError(400, 'Missing code')
    }
    let input: JoinGameInput
    if (req.user) {
      input = joinGameSchema.parse({
        player_name: req.user.fullname,
        player_id: req.user.id,
        player_avatar: req.user.avatar
      })
    } else {
      input = joinGameSchema
        .omit({ player_id: true })
        .required({ player_guest_id: true })
        .parse(req.body)
    }
    const { player, socketToken } = await gameService.joinGame(code, input)
    return success(res, { player, socketToken }, 201)
  } catch (e) {
    next(e)
  }
}

export const getHostToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized')
    const hostToken = await gameService.issueHostToken(Number(req.params['id']), req.user.id)
    return success(res, { hostToken })
  } catch (e) {
    next(e)
  }
}

export const getLeaderboard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const leaderboard = await gameService.getLeaderboard(Number(req.params['id']))
    return success(res, { leaderboard })
  } catch (e) {
    next(e)
  }
}

export const getResults = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const results = await gameService.getResults(Number(req.params['id']))
    return success(res, { results })
  } catch (e) {
    next(e)
  }
}

export const getReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = (req.header('x-socket-token') ?? req.query['token']) as string | undefined
    const review = await gameService.getPlayerReview(Number(req.params['id']), token)
    return success(res, { review })
  } catch (e) {
    next(e)
  }
}
