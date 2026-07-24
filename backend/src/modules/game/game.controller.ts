import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../shared/types/shared.types.js'
import { createGameSchema, joinGameSchema, updateConfigSchema, type GameConfig } from './game.schemas.js'
import * as gameService from './game.services.js'

export const listGameModes = (_req: AuthRequest, res: Response) =>
  res.json({ data: gameService.listGameModes() })

export const createGame = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = createGameSchema.parse(req.body)
    const game = await gameService.createGame(input, req.user!.id)
    res.status(201).json({ data: game })
  } catch (e) {
    next(e)
  }
}

export const getGameByCode = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const code = req.params['code'] as string
    if (!code) { res.status(400).json({ error: 'Missing code' }); return }
    res.json({ data: await gameService.getLobby(code) })
  } catch (e) {
    next(e)
  }
}

export const updateGameConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { config } = updateConfigSchema.parse(req.body)
    const game = await gameService.updateGameConfig(
      Number(req.params['id']),
      req.user!.id,
      config as Partial<GameConfig>
    )
    res.json({ data: game })
  } catch (e) {
    next(e)
  }
}

export const joinGame = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const code = req.params['code'] as string
    if (!code) { res.status(400).json({ error: 'Missing code' }); return }
    const input = joinGameSchema.parse(req.body)
    res.status(201).json({ data: await gameService.joinGame(code, input) })
  } catch (e) {
    next(e)
  }
}

export const getHostToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await gameService.issueHostToken(Number(req.params['id']), req.user!.id) })
  } catch (e) {
    next(e)
  }
}

export const getLeaderboard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await gameService.getLeaderboard(Number(req.params['id'])) })
  } catch (e) {
    next(e)
  }
}

export const getResults = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await gameService.getResults(Number(req.params['id'])) })
  } catch (e) {
    next(e)
  }
}
