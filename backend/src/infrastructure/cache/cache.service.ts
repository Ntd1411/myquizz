import { redisClient } from './redis.client.js'
import type { Redis } from 'ioredis'

export class CacheService {
  private static readonly DEFAULT_TTL = 3600 // 1 giờ
  private static get client(): Redis {
    return redisClient
  }

  /**
   * Lưu giá trị vào cache
   */
  static async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const stringValue = JSON.stringify(value)
    const ttl = ttlSeconds || this.DEFAULT_TTL

    await this.client.setex(key, ttl, stringValue)
  }

  /**
   * Lấy giá trị từ cache
   */
  static async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key)

    if (!value) {
      return null
    }

    return JSON.parse(value) as T
  }

  /**
   * Xóa một key khỏi cache
   */
  static async delete(key: string): Promise<void> {
    await this.client.del(key)
  }

  /**
   * Xóa nhiều keys khỏi cache
   */
  static async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return
    await this.client.del(...keys)
  }

  /**
   * Xóa tất cả keys theo pattern
   */
  static async deleteByPattern(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern)
    if (keys.length > 0) {
      await this.client.del(...keys)
    }
  }

  /**
   * Kiểm tra key có tồn tại không
   */
  static async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key)
    return result === 1
  }

  /**
   * Đặt thời gian hết hạn cho key
   */
  static async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds)
  }

  /**
   * Lấy thời gian còn lại của key (seconds)
   */
  static async ttl(key: string): Promise<number> {
    return await this.client.ttl(key)
  }

  /**
   * Tăng giá trị số nguyên
   */
  static async increment(key: string, amount: number = 1): Promise<number> {
    return await this.client.incrby(key, amount)
  }

  /**
   * Giảm giá trị số nguyên
   */
  static async decrement(key: string, amount: number = 1): Promise<number> {
    return await this.client.decrby(key, amount)
  }

  /**
   * Thêm phần tử vào set
   */
  static async addToSet(key: string, ...members: string[]): Promise<void> {
    await this.client.sadd(key, ...members)
  }

  /**
   * Lấy tất cả phần tử trong set
   */
  static async getSetMembers(key: string): Promise<string[]> {
    return await this.client.smembers(key)
  }

  /**
   * Xóa phần tử khỏi set
   */
  static async removeFromSet(key: string, ...members: string[]): Promise<void> {
    await this.client.srem(key, ...members)
  }

  /**
   * Kiểm tra phần tử có trong set không
   */
  static async isInSet(key: string, member: string): Promise<boolean> {
    const result = await this.client.sismember(key, member)
    return result === 1
  }

  /**
   * Lưu hash object
   */
  static async setHash(key: string, field: string, value: unknown): Promise<void> {
    const stringValue = JSON.stringify(value)
    await this.client.hset(key, field, stringValue)
  }

  /**
   * Lấy giá trị từ hash
   */
  static async getHash<T>(key: string, field: string): Promise<T | null> {
    const value = await this.client.hget(key, field)

    if (!value) {
      return null
    }

    return JSON.parse(value) as T
  }

  /**
   * Lấy tất cả fields trong hash
   */
  static async getAllHash<T>(key: string): Promise<Record<string, T>> {
    const hash = await this.client.hgetall(key)
    const result: Record<string, T> = {}

    for (const [field, value] of Object.entries(hash)) {
      if (typeof value === 'string') {
        result[field] = JSON.parse(value) as T
      }
    }

    return result
  }

  /**
   * Xóa field khỏi hash
   */
  static async deleteHashField(key: string, ...fields: string[]): Promise<void> {
    await this.client.hdel(key, ...fields)
  }

  /**
   * Xóa toàn bộ cache
   */
  static async flush(): Promise<void> {
    await this.client.flushdb()
  }

  /**
   * Cache với callback - tự động lưu kết quả nếu chưa có
   */
  static async getOrSet<T>(
    key: string,
    callback: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = await this.get<T>(key)

    if (cached !== null) {
      return cached
    }

    const result = await callback()
    await this.set(key, result, ttlSeconds)

    return result
  }
}

export default CacheService
