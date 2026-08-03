import ms from 'ms'
import { env } from '../../infrastructure/config/envconfig.js'
import { STATE_TTL_MS } from '../../modules/auth/auth.type.js'

const isProd = env.NODE_ENV === 'production'

// Same-site subdomain (app <-> api) means 'lax' is enough and safer than 'none'.
const baseCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? ('lax' as const) : ('lax' as const)
}

export const accessCookieOptions = {
  ...baseCookieOptions,
  maxAge: ms(env.JWT_EXPIRES_IN as ms.StringValue)
}

export const refreshCookieOptions = {
  ...baseCookieOptions,
  maxAge: ms(env.JWT_REFRESH_EXPIRES_IN as ms.StringValue)
}

export const stateCookieOptions = {
  ...baseCookieOptions,
  maxAge: STATE_TTL_MS
}

// clearCookie only matches when the attributes match the ones used on set.
export const clearCookieOptions = baseCookieOptions
