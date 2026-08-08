import {
  DEFAULT_CACHE_TTL_SECONDS,
  getOrSetCache
} from '../../infrastructure/cache/cache.helper.js'
import * as feedRepository from './feed.repository.js'
import { decodeFeedCursor, encodeFeedCursor } from './feed.cursor.js'
import type {
  FeedPage,
  HomeSection,
  HomeSectionConfig,
  QuizCard
} from './home.type.js'

/**
 * Cache key version prefix. Bump it whenever the payload shape changes, so a
 * deploy cannot serve old-shaped JSON to a new client for up to five minutes.
 */
const CACHE_VERSION = 'v1'

/**
 * Resolves the items of one configured row.
 *
 * Sections whose prerequisites are missing return an empty array rather than
 * throwing: a logged-out visitor has no Continue playing row, and a category row
 * with no category configured is a data error that should not break the whole
 * home screen. Empty rows are dropped by the caller.
 */
async function resolveSectionItems(
  config: HomeSectionConfig,
  userId: number | undefined
): Promise<QuizCard[]> {
  switch (config.section_type) {
  case 'featured':
    return feedRepository.getFeaturedQuizzes(config.item_limit)
  case 'continue':
    if (userId === undefined) {
      return []
    }
    return feedRepository.getContinuePlaying(userId, config.item_limit)
  case 'trending':
    return feedRepository.getTrendingQuizzes(config.item_limit)
  case 'newest':
    return feedRepository.getNewestQuizzes(config.item_limit)
  case 'category':
    if (!config.category_name) {
      console.warn(
        `Home section ${config.section_key} is type category with no category_name`
      )
      return []
    }
    return feedRepository.getCategoryQuizzes(
      config.category_name,
      config.item_limit
    )
  default:
    return []
  }
}

async function buildHomeSections(
  userId: number | undefined
): Promise<HomeSection[]> {
  const configs = await feedRepository.getActiveHomeSections()

  // Rows are independent queries, so they run concurrently rather than serially.
  const sections = await Promise.all(
    configs.map(async (config) => ({
      section_key: config.section_key,
      title: config.title,
      section_type: config.section_type,
      items: await resolveSectionItems(config, userId)
    }))
  )

  // An empty row is omitted entirely: a new user should not see a bare
  // "Continue playing" heading with nothing under it.
  return sections.filter((section) => section.items.length > 0)
}

/**
 * Home screen rows.
 *
 * The cache key is per user whenever the caller is authenticated. That
 * over-partitions slightly when no Continue playing row is active, but the
 * alternative is deciding the key from configuration that itself has to be read
 * first, and a wrong guess would leak one user's resumable quizzes to another.
 * At five-minute TTL the extra keys are cheap; a cross-user leak would not be.
 */
export async function getHomeService(
  userId: number | undefined
): Promise<{ sections: HomeSection[]; cached: boolean }> {
  const cacheKey =
    userId === undefined
      ? `home:${CACHE_VERSION}:anon`
      : `home:${CACHE_VERSION}:user:${userId}`

  const { value, cached } = await getOrSetCache(
    cacheKey,
    () => buildHomeSections(userId),
    DEFAULT_CACHE_TTL_SECONDS
  )

  return { sections: value, cached }
}

/**
 * One page of the infinite feed.
 *
 * The cursor is decoded before the cache lookup on purpose: a malformed cursor
 * must fail as a 400 without reserving a cache entry, and the decoded form is
 * what the key is built from, so two encodings of the same position share a key.
 */
export async function getFeedService(query: {
  topic?: string | undefined;
  cursor?: string | undefined;
  limit: number;
}): Promise<{ page: FeedPage; cached: boolean }> {
  const cursor = query.cursor ? decodeFeedCursor(query.cursor) : null

  const position = cursor ? `${cursor.hotScore}|${cursor.id}` : 'first'
  const topic = query.topic ?? 'all'
  const cacheKey =
    `feed:${CACHE_VERSION}:topic:${topic}:limit:${query.limit}:at:${position}`

  const { value, cached } = await getOrSetCache<FeedPage>(
    cacheKey,
    async () => {
      const result = await feedRepository.getFeedPage({
        cursor,
        limit: query.limit,
        category: query.topic
      })

      return {
        items: result.items,
        hasMore: result.hasMore,
        nextCursor: result.lastPosition
          ? encodeFeedCursor(result.lastPosition)
          : null
      }
    },
    DEFAULT_CACHE_TTL_SECONDS
  )

  return { page: value, cached }
}
