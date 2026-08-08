import RedisClient, { redisClient } from './redis.client.js'

/** Home and feed payloads tolerate five minutes of staleness. */
export const DEFAULT_CACHE_TTL_SECONDS = 300

export interface CachedResult<T> {
  value: T;
  cached: boolean;
}

/**
 * Read-through cache around a producer function, fail-open by design.
 *
 * Redis here is an accelerator, not a source of truth: if it is down, slow, or
 * returns something unparseable, the request must still succeed by hitting
 * Postgres. That is why this is the one place where a broad catch is correct —
 * it is a deliberate degradation boundary, not blanket error swallowing. Every
 * failure is logged so an outage stays visible instead of turning into silent
 * latency.
 *
 * `isConnected()` is checked first so that a known-down Redis costs no waiting
 * at all; without it, ioredis would queue each command and burn its three
 * retries per request before rejecting.
 */
export async function getOrSetCache<T>(
  key: string,
  producer: () => Promise<T>,
  ttlSeconds: number = DEFAULT_CACHE_TTL_SECONDS
): Promise<CachedResult<T>> {
  const hit = await readCache<T>(key)

  if (hit !== null) {
    return { value: hit.value, cached: true }
  }

  const value = await producer()
  await writeCache(key, value, ttlSeconds)

  return { value, cached: false }
}

/**
 * Returns a wrapper object rather than `T | null` on purpose: a cached value may
 * legitimately be `null` or an empty array, and those must count as hits.
 */
async function readCache<T>(key: string): Promise<{ value: T } | null> {
  if (!RedisClient.isConnected()) {
    return null
  }

  try {
    const raw = await redisClient.get(key)

    if (raw === null) {
      return null
    }

    return { value: JSON.parse(raw) as T }
  } catch (error) {
    // Covers both a Redis failure and a JSON.parse failure on a poisoned key.
    console.error(`Cache read failed for key ${key}:`, error)
    return null
  }
}

async function writeCache(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  if (!RedisClient.isConnected()) {
    return
  }

  try {
    await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  } catch (error) {
    console.error(`Cache write failed for key ${key}:`, error)
  }
}

/** Used by tests and by manual cache busting after a deploy. */
export async function deleteCacheKeys(keys: string[]): Promise<void> {
  if (keys.length === 0 || !RedisClient.isConnected()) {
    return
  }

  try {
    await redisClient.del(...keys)
  } catch (error) {
    console.error('Cache delete failed:', error)
  }
}
