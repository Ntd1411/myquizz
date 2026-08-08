import { AppError } from '../../shared/errors/AppError.js'
import { userRepository } from '../user/user.repository.js'
import * as listingRepository from './listing.repository.js'
import {
  computeFilterFingerprint,
  decodeListCursor,
  encodeListCursor
} from './listing.cursor.js'
import type { FilterInput, ListCursor } from './listing.cursor.js'
import type { ListPage, ListSort } from './listing.type.js'
import type {
  ListingRowsPage,
  OwnQuizzesSort,
  OwnerProfileSort,
  SearchFilters,
  SearchSort
} from './listing.repository.js'
import type {
  MyQuizzesQuery,
  OwnerQuizzesQuery,
  SearchQuizzesQuery
} from './quiz.schema.js'

/*
 * Business rules of the three listing endpoints. Visibility itself lives in SQL
 * (listing.repository.ts); what happens here is deciding the effective sort,
 * fingerprinting the filters a cursor belongs to, and turning a repository page
 * into the response shape. Nothing is cached: unlike the feed, these queries
 * carry too many parameter combinations for a cache to earn its keep, and
 * /quizzes/me must never serve a stale view of the author's own work.
 */

/**
 * Decodes the cursor of an incoming request, if any.
 *
 * The expected sort and filter fingerprint are passed in so a cursor replayed
 * against a different ordering or a different filter set fails as a 400 instead
 * of quietly paging through unrelated rows.
 */
function resolveCursor(
  raw: string | undefined,
  sort: ListSort,
  filterHash: string
): ListCursor | null {
  if (!raw) {
    return null
  }

  return decodeListCursor(raw, { sort, filterHash })
}

/** Turns a repository page into the client-facing page, minting the next cursor. */
function buildPage(
  rows: ListingRowsPage,
  sort: ListSort,
  filterHash: string,
  total?: number
): ListPage {
  let nextCursor: string | null = null

  if (rows.lastPosition) {
    nextCursor = encodeListCursor({
      sort,
      filterHash,
      primaryValue: rows.lastPosition.primaryValue,
      id: rows.lastPosition.id
    })
  }

  const page: ListPage = {
    items: rows.items,
    nextCursor,
    hasMore: rows.hasMore
  }

  // total is absent unless the caller asked for it, so its absence and a real
  // zero stay distinguishable.
  if (total !== undefined) {
    page.total = total
  }

  return page
}

/**
 * The sort a search actually runs with.
 *
 * relevance has nothing to score without a keyword, so it degrades to newest
 * rather than erroring: a client that keeps its sort while clearing the search
 * box is doing something reasonable.
 */
function resolveSearchSort(query: SearchQuizzesQuery): SearchSort {
  if (!query.sort) {
    return query.keyword ? 'relevance' : 'newest'
  }

  if (query.sort === 'relevance' && !query.keyword) {
    return 'newest'
  }

  return query.sort
}

// Query parameters become repository filters one at a time, so an absent
// parameter stays absent instead of becoming an explicit undefined.
function buildSearchFilters(query: SearchQuizzesQuery): SearchFilters {
  const filters: SearchFilters = { mine: query.mine }

  if (query.keyword) {
    filters.keyword = query.keyword
  }

  if (query.language) {
    filters.language = query.language
  }

  if (query.category) {
    filters.category = query.category
  }

  if (query.created_from) {
    filters.createdFrom = query.created_from
  }

  if (query.created_to) {
    filters.createdTo = query.created_to
  }

  if (query.min_questions !== undefined) {
    filters.minQuestions = query.min_questions
  }

  if (query.min_plays !== undefined) {
    filters.minPlays = query.min_plays
  }

  if (query.owner_id !== undefined) {
    filters.ownerId = query.owner_id
  }

  return filters
}

/**
 * Everything that changes which rows a search matches, fingerprinted into the
 * cursor. The viewer is included because visibility depends on it. limit is not:
 * changing the page size mid-scroll is harmless to a keyset walk.
 */
function searchFingerprint(
  viewerId: number | null,
  filters: SearchFilters
): FilterInput {
  return {
    scope: 'search',
    viewer: viewerId,
    keyword: filters.keyword,
    language: filters.language,
    category: filters.category,
    createdFrom: filters.createdFrom,
    createdTo: filters.createdTo,
    minQuestions: filters.minQuestions,
    minPlays: filters.minPlays,
    ownerId: filters.ownerId,
    mine: filters.mine
  }
}

/**
 * One page of search results.
 *
 * Anonymous callers see public quizzes that have at least one question;
 * authenticated callers additionally see all of their own quizzes.
 */
export async function searchQuizzesService(input: {
  viewerId: number | null;
  query: SearchQuizzesQuery;
}): Promise<ListPage> {
  // mine cannot be validated by the schema, which never sees the session.
  if (input.query.mine && input.viewerId === null) {
    throw new AppError(400, 'mine=true requires an authenticated session')
  }

  const sort = resolveSearchSort(input.query)
  const filters = buildSearchFilters(input.query)
  const filterHash = computeFilterFingerprint(
    searchFingerprint(input.viewerId, filters)
  )
  const cursor = resolveCursor(input.query.cursor, sort, filterHash)

  const rows = await listingRepository.searchQuizzes({
    viewerId: input.viewerId,
    filters,
    sort,
    cursor,
    limit: input.query.limit
  })

  let total: number | undefined

  if (input.query.include_total) {
    total = await listingRepository.countSearchQuizzes({
      viewerId: input.viewerId,
      filters
    })
  }

  return buildPage(rows, sort, filterHash, total)
}

/**
 * One page of a user's public profile.
 *
 * A missing or deactivated owner is a 404. An existing owner with nothing public
 * is a 200 with an empty page: having published nothing is not an error.
 */
export async function getPublicQuizzesByOwnerService(input: {
  ownerId: number;
  query: OwnerQuizzesQuery;
}): Promise<ListPage> {
  const ownerExists = await userRepository.existsById(input.ownerId)

  if (!ownerExists) {
    throw new AppError(404, 'User not found')
  }

  const sort: OwnerProfileSort = input.query.sort
  const filterHash = computeFilterFingerprint({
    scope: 'owner_profile',
    ownerId: input.ownerId
  })
  const cursor = resolveCursor(input.query.cursor, sort, filterHash)

  const rows = await listingRepository.getPublicQuizzesByOwner({
    ownerId: input.ownerId,
    sort,
    cursor,
    limit: input.query.limit
  })

  let total: number | undefined

  if (input.query.include_total) {
    total = await listingRepository.countPublicQuizzesByOwner(input.ownerId)
  }

  return buildPage(rows, sort, filterHash, total)
}

/** One page of the caller's own quizzes, including private and empty ones. */
export async function getOwnQuizzesService(input: {
  viewerId: number;
  query: MyQuizzesQuery;
}): Promise<ListPage> {
  const sort: OwnQuizzesSort = input.query.sort
  const keyword = input.query.keyword
  const filterHash = computeFilterFingerprint({
    scope: 'own',
    viewer: input.viewerId,
    visibility: input.query.visibility,
    keyword
  })
  const cursor = resolveCursor(input.query.cursor, sort, filterHash)

  const rows = await listingRepository.getOwnQuizzes({
    viewerId: input.viewerId,
    visibility: input.query.visibility,
    ...(keyword ? { keyword } : {}),
    sort,
    cursor,
    limit: input.query.limit
  })

  let total: number | undefined

  if (input.query.include_total) {
    total = await listingRepository.countOwnQuizzes({
      viewerId: input.viewerId,
      visibility: input.query.visibility,
      ...(keyword ? { keyword } : {})
    })
  }

  return buildPage(rows, sort, filterHash, total)
}
