import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../auth/auth.type.js'
import * as homeService from './home.service.js'
import { success } from '../../shared/utils/response.js'
import type { FeedQuery } from './quiz.schema.js'

export async function getHome(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Optional auth: an anonymous visitor simply gets no Continue playing row.
    const userId = req.user?.id

    const { sections, cached } = await homeService.getHomeService(userId)

    return success(res, { sections }, 200, { cached })
  } catch (error) {
    next(error)
  }
}

export async function getFeed(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // validatedQuery is typed as unknown on AuthRequest, so the shape validated
    // by feedQuerySchema has to be reasserted here.
    const { topic, cursor, limit } = req.validatedQuery as FeedQuery

    const { page, cached } = await homeService.getFeedService({
      topic,
      cursor,
      limit
    })

    // Paging state goes in meta.pagination, matching where the existing
    // offset-based endpoints put theirs, so clients read it from one place.
    return success(res, { quizzes: page.items }, 200, {
      cached,
      pagination: {
        limit,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore
      }
    })
  } catch (error) {
    next(error)
  }
}
