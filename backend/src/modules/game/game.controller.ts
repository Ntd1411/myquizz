import type { Response, NextFunction } from 'express'
import {
  createGameSchema, guestIdHeaderSchema, joinGameSchema, updateConfigSchema,
  type GameIdParams, type HistoryQuery, type JoinGameInput
} from './game.schema.js'
import * as gameService from './game.service.js'
import { AppError } from '../../shared/errors/AppError.js'
import type { AuthRequest } from '../auth/auth.type.js'
import type { HistoryViewer } from './game.type.js'
import { success } from '../../shared/utils/response.js'

/**
 * Identity of a history reader.
 *
 * A cookie always wins: a signed-in reader must not be able to read another
 * browser's guest history by pasting its UUID into the header. The guest id travels
 * in a header rather than the query string because it is the only secret protecting
 * that history, and query strings end up in access logs and referrers.
 */
const historyViewer = (req: AuthRequest): HistoryViewer => {
  if (req.user) return { userId: req.user.id, guestId: null }
  const parsed = guestIdHeaderSchema.safeParse(req.header('x-guest-id'))
  return { userId: null, guestId: parsed.success ? parsed.data : null }
}

export const listGameModes = (_req: AuthRequest, res: Response) =>
  success(res, { gameModes: gameService.listGameModes() })

export const createGame = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized', 'AUTH_TOKEN_MISSING')
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
      throw new AppError(400, 'Missing code', 'VALIDATION_ERROR')
    }
    const session = await gameService.getLobby(code)
    return success(res, { session })
  } catch (e) {
    next(e)
  }
}

export const updateGameConfig = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized', 'AUTH_TOKEN_MISSING')
    if (Number.isInteger(Number(req.params['id'])) === false) {
      throw new AppError(400, 'Invalid game ID', 'VALIDATION_ERROR')
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
      throw new AppError(400, 'Missing code', 'VALIDATION_ERROR')
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
    if (!req.user) throw new AppError(401, 'Unauthorized', 'AUTH_TOKEN_MISSING')
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

export const getHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const query = req.validatedQuery as HistoryQuery
    const page = await gameService.getPlayHistory(historyViewer(req), query)

    // Same pagination block as every listing endpoint, so a client can reuse one
    // handler. total is only present when the caller asked for it.
    const pagination: {
      limit: number
      nextCursor: string | null
      hasMore: boolean
      total?: number
    } = { limit: query.limit, nextCursor: page.nextCursor, hasMore: page.hasMore }
    if (page.total !== undefined) pagination.total = page.total

    return success(res, { sessions: page.items }, 200, { pagination })
  } catch (e) {
    next(e)
  }
}

export const getHistorySummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.validatedParams as GameIdParams
    const summary = await gameService.getHistorySummary(id, historyViewer(req))
    return success(res, { summary })
  } catch (e) {
    next(e)
  }
}

export const getMyAnswers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.validatedParams as GameIdParams
    const review = await gameService.getHistoryAnswers(id, historyViewer(req))
    return success(res, { review })
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
