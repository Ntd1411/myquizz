import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../auth/auth.type.js'
import * as listingService from './listing.service.js'
import { success } from '../../shared/utils/response.js'
import { AppError } from '../../shared/errors/AppError.js'
import type { ListPage } from './listing.type.js'
import type {
  MyQuizzesQuery,
  OwnerIdParams,
  OwnerQuizzesQuery,
  SearchQuizzesQuery
} from './quiz.schema.js'

/*
 * HTTP edge of the listing endpoints: read the validated request, call one
 * service, shape the envelope. No SQL, no visibility rules, and no `as number`
 * coercion of an absent user.
 */

/**
 * Paging state for meta, shaped exactly like the feed's so a client can reuse one
 * handler. total only appears when the caller asked for it with include_total.
 */
function paginationMeta(limit: number, page: ListPage) {
  const pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
    total?: number;
  } = {
    limit,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore
  }

  if (page.total !== undefined) {
    pagination.total = page.total
  }

  return { pagination }
}

export async function searchQuizzes(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const query = req.validatedQuery as SearchQuizzesQuery
    // Anonymous callers stay null rather than being coerced to a number: the SQL
    // visibility rule reads null as "owned by nobody".
    const viewerId = req.user?.id ?? null

    const page = await listingService.searchQuizzesService({ viewerId, query })

    return success(res, { quizzes: page.items }, 200, paginationMeta(query.limit, page))
  } catch (error) {
    next(error)
  }
}

export async function getMyQuizzes(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const query = req.validatedQuery as MyQuizzesQuery
    const viewerId = req.user?.id

    // authMiddleware already guarantees a session; this keeps the type honest
    // instead of asserting one with `as number`.
    if (viewerId === undefined) {
      throw new AppError(401, 'Authentication required')
    }

    const page = await listingService.getOwnQuizzesService({ viewerId, query })

    return success(res, { quizzes: page.items }, 200, paginationMeta(query.limit, page))
  } catch (error) {
    next(error)
  }
}

export async function getQuizzesByOwner(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Public profile: the caller's identity does not change the result, so the
    // session is deliberately not read here.
    const { ownerId } = req.validatedParams as OwnerIdParams
    const query = req.validatedQuery as OwnerQuizzesQuery

    const page = await listingService.getPublicQuizzesByOwnerService({ ownerId, query })

    return success(res, { quizzes: page.items }, 200, paginationMeta(query.limit, page))
  } catch (error) {
    next(error)
  }
}
