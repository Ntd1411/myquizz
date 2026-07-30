import bcrypt from 'bcrypt'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { env } from '../../infrastructure/config/envconfig.js'
import ms from 'ms'

// Token hashing
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10)
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(password, hash)
}

// Token generation
export function generateTokens(userId: number) {
  const accessToken = jwt.sign({ userId, type: 'access' }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as ms.StringValue
  })

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as ms.StringValue
    }
  )

  return { accessToken, refreshToken }
}

export function verifyToken(token: string, type: 'access' | 'refresh'): { userId: number; type: string } | null {
  try {
    const secret = type === 'access' ? env.JWT_SECRET : env.JWT_REFRESH_SECRET
    return jwt.verify(token, secret) as { userId: number; type: string }
  } catch {
    return null
  }
}
