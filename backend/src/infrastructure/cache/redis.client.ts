import { Redis } from 'ioredis'
import { env } from '../config/envconfig.js'

class RedisClient {
  private static instance: Redis | null = null

  private constructor() {}

  public static getInstance(): Redis {
    if (!RedisClient.instance) {
      RedisClient.instance = new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000)
          return delay
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false
      })

      RedisClient.instance.on('connect', () => {
        console.log('Redis client connected')
      })

      RedisClient.instance.on('error', (error: Error) => {
        console.error('Redis client error:', error)
      })

      RedisClient.instance.on('ready', () => {
        console.log('Redis client ready')
      })

      RedisClient.instance.on('close', () => {
        console.log('Redis client connection closed')
      })
    }

    return RedisClient.instance
  }

  public static async disconnect(): Promise<void> {
    if (RedisClient.instance) {
      await RedisClient.instance.quit()
      RedisClient.instance = null
      console.log('Redis client disconnected')
    }
  }

  public static isConnected(): boolean {
    return RedisClient.instance?.status === 'ready'
  }
}

export const redisClient = RedisClient.getInstance()
export default RedisClient
