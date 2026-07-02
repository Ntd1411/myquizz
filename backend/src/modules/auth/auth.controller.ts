import type { Request, Response, NextFunction } from 'express'
import { env } from '../../infrastructure/config/envconfig.js'
import ms from 'ms'
import { type AuthRequest } from '../../shared/types/shared.types.js'
import {
  loginService,
  logoutService,
  refreshTokenService,
  registerService
} from './auth.services.js'

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as { email?: string; password?: string }
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'Email and password are required' })
    }

    const deviceName = req.headers['user-agent'] || 'Unknown Device'
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown'

    const result = await loginService(email, password, deviceName, ipAddress)

    // Set HttpOnly cookies
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      maxAge: ms(env.JWT_EXPIRES_IN as ms.StringValue),
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax'
    })

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      maxAge: ms(env.JWT_REFRESH_EXPIRES_IN as ms.StringValue),
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax'
    })

    res.json({
      user: result.user
    })
  } catch (error) {
    next(error)
  }
}

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { email, phone, password, fullname } = req.body as {
      email?: string
      phone?: string
      password?: string
      fullname?: string
    }

    if (!email || !password || !fullname) {
      return res.status(400).json({
        message: 'Email, password, and fullname are required'
      })
    }

    const result = await registerService(
      email,
      password,
      fullname,
      phone || null
    )
    res.status(201).json(result)
  } catch (error) {
    next(error)
  }
}

export async function refreshToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const refreshToken = req.cookies.refreshToken as string | undefined

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token missing' })
    }

    const tokens = await refreshTokenService(refreshToken)

    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      maxAge: ms(env.JWT_EXPIRES_IN as ms.StringValue),
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax'
    })

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      maxAge: ms(env.JWT_REFRESH_EXPIRES_IN as ms.StringValue),
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax'
    })

    res.json({ message: 'Token refreshed successfully' })
  } catch (error) {
    next(error)
  }
}

export async function logout(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const accessToken = req.token || ''
    const userId = req.user?.id || 0
    const refreshToken = req.cookies.refreshToken as string | undefined

    if (!accessToken || !refreshToken) {
      return res
        .status(400)
        .json({ message: 'Access token and refresh token are required' })
    }

    await logoutService(userId, accessToken, refreshToken)

    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax'
    })

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax'
    })

    res.json({ message: 'Logged out successfully' })
  } catch (error) {
    next(error)
  }
}
