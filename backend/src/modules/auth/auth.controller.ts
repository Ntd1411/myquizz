import type { Request, Response, NextFunction } from 'express'
import { env } from '../../infrastructure/config/envconfig.js'
import ms from 'ms'
import {
  getGoogleAuthUrl,
  loginService,
  loginWithGoogle,
  loginWithGoogleCredential,
  logoutService,
  refreshTokenService,
  registerService
} from './auth.services.js'
import crypto from 'crypto'
import { AppError } from '../../shared/errors/AppError.js'
import { generateTokens, hashToken } from './auth.utils.js'
import { authRepository } from './auth.repository.js'
import { STATE_COOKIE, STATE_TTL_MS, type AuthRequest } from './auth.type.js'

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

export function googleRedirect(_req: Request, res: Response) {
  const state = crypto.randomBytes(16).toString('hex')

  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: STATE_TTL_MS
  })

  res.redirect(getGoogleAuthUrl(state))
}

export async function googleCallback(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { code, state, error } = req.query as {
      code?: string
      state?: string
      error?: string
    }

    if (error) {
      throw new AppError(401, `Google OAuth error: ${error}`)
    }
    if (!code || !state) {
      throw new AppError(400, 'Missing authorization code or state')
    }

    // Validate anti-CSRF state against the cookie set in googleRedirect
    const cookieState = req.cookies?.g_oauth_state as string | undefined
    if (!cookieState || cookieState !== state) {
      throw new AppError(401, 'Invalid OAuth state')
    }
    res.clearCookie(STATE_COOKIE, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax'
    })

    // Resolve or create the user
    const user = await loginWithGoogle(code)

    // Issue tokens exactly like loginService
    const tokens = generateTokens(user.id)

    const deviceName = req.headers['user-agent'] || 'Unknown Device'
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown'

    await authRepository.saveRefreshToken(
      user.id,
      deviceName,
      ipAddress,
      hashToken(tokens.refreshToken),
      new Date(Date.now() + ms(env.JWT_REFRESH_EXPIRES_IN as ms.StringValue))
    )

    // Same cookies as the normal login flow
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

    // Browser came here via a top-level redirect, so send it back to the app
    // res.redirect(`${env.FRONTEND_URL}/auth/callback`)
    res.redirect('http://localhost:5173/google-oauth-test')
  } catch (err) {
    next(err)
  }
}

// One Tap: receive the Google credential (id_token), verify, issue our cookies
export async function googleOneTap(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { credential } = req.body as { credential?: string }
    if (!credential) {
      throw new AppError(400, 'Missing Google credential')
    }

    const user = await loginWithGoogleCredential(credential)

    // Issue tokens exactly like the redirect flow
    const tokens = generateTokens(user.id)
    const deviceName = req.headers['user-agent'] || 'Unknown Device'
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown'

    await authRepository.saveRefreshToken(
      user.id,
      deviceName,
      ipAddress,
      hashToken(tokens.refreshToken),
      new Date(Date.now() + ms(env.JWT_REFRESH_EXPIRES_IN as ms.StringValue))
    )

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

    // AJAX request: return JSON instead of redirecting
    res.json({
      success: true,
      user: { id: user.id, email: user.email, fullname: user.fullname, avatar: user.avatar }
    })
  } catch (err) {
    next(err)
  }
}
