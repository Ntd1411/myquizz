/**
 * Authentication endpoints.
 *
 * Every successful sign-in sets HttpOnly accessToken and refreshToken cookies,
 * so the reference UI has no Authorize button and no Cookie field to fill in:
 * call POST /auth/login once and the browser sends the cookies on the
 * following requests by itself.
 *
 * Status codes and error messages below are the ones auth.controller.ts and
 * auth.service.ts actually produce.
 */

import type { PathMap, TagObject } from '../types.js'
import {
  AUTH_NOTE,
  errorResponse,
  jsonBody,
  messageData,
  object,
  ref,
  successExample,
  successResponse,
  validationError
} from '../types.js'

export const authTag: TagObject = {
  name: 'Authentication',
  description:
    'Create an account, exchange credentials for cookies, refresh them, and sign in with Google.'
}

const userData = object({ user: ref('User') }, ['user'])

// Every endpoint that returns a user returns this exact row, minus password
// and deleted_at, which the service strips before responding.
const exampleUser = {
  id: 3,
  fullname: 'Demo User',
  email: 'demo@myquizz.com',
  phone: '0912345678',
  role: 'user',
  avatar: null,
  description: null,
  auth_provider: 'local',
  created_at: '2026-08-11T21:09:24.744Z',
  updated_at: '2026-08-11T21:09:24.744Z'
}

export const authPaths: PathMap = {
  '/auth/register': {
    post: {
      summary: 'Register a user',
      description:
        'Creates an account and signs it in immediately by setting the accessToken and refreshToken cookies. The created user is returned without its password.',
      tags: [authTag.name],
      requestBody: jsonBody(
        object(
          {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', format: 'password', minLength: 8 },
            fullname: { type: 'string', minLength: 2, maxLength: 100 },
            phone: {
              type: 'string',
              description: 'Optional, 7-15 digits (regex ^\\+?[0-9]{7,15}$)'
            }
          },
          ['email', 'password', 'fullname']
        ),
        {
          example: {
            email: 'demo@myquizz.com',
            password: 'Password123!',
            fullname: 'Demo User',
            phone: '0912345678'
          }
        }
      ),
      responses: {
        201: successResponse({
          description:
            'Registered. Sets the accessToken and refreshToken HttpOnly cookies.',
          data: userData,
          example: successExample({ user: exampleUser })
        }),
        400: errorResponse('Missing field or rejected payload', [
          'Email, password, and fullname are required',
          validationError({ password: 'Too small: expected string to have >=8 characters' })
        ]),
        409: errorResponse('Email or phone already taken', [
          'Email already registered',
          'Phone number already registered'
        ]),
        500: errorResponse('The row could not be written', [
          'Failed to create user'
        ])
      }
    }
  },

  '/auth/login': {
    post: {
      summary: 'Log in',
      description:
        'Exchanges email and password for the accessToken and refreshToken cookies. Both wrong email and wrong password answer the same message on purpose.',
      tags: [authTag.name],
      requestBody: jsonBody(
        object(
          {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', format: 'password' }
          },
          ['email', 'password']
        ),
        {
          example: {
            email: 'demo@myquizz.com',
            password: 'Password123!'
          }
        }
      ),
      responses: {
        200: successResponse({
          description:
            'Logged in. Sets the accessToken and refreshToken HttpOnly cookies.',
          data: userData,
          example: successExample({ user: exampleUser })
        }),
        400: errorResponse('Missing credentials', [
          'Email and password are required'
        ]),
        401: errorResponse('Unknown email or wrong password', [
          'Invalid email or password'
        ]),
        403: errorResponse('The account was deactivated', [
          'Account is deactivated'
        ])
      }
    }
  },

  '/auth/refresh': {
    post: {
      summary: 'Refresh tokens',
      description:
        'Rotates both tokens using the refreshToken cookie and resets the two cookies. The tokens themselves are never echoed in the body, only a confirmation message. Requires the refreshToken cookie, which the browser sends on its own.',
      tags: [authTag.name],
      responses: {
        200: successResponse({
          description:
            'New accessToken and refreshToken cookies were set on the response.',
          data: messageData('Tokens refreshed successfully'),
          example: successExample({
            message: 'Tokens refreshed successfully'
          })
        }),
        400: errorResponse('No refreshToken cookie was sent', [
          'Refresh token is required'
        ]),
        401: errorResponse(
          'The refresh token is invalid, already rotated, or its user is gone. Every session of that user is revoked when an unknown token is replayed.',
          ['Invalid refresh token', 'User not found']
        ),
        403: errorResponse('The account was deactivated', [
          'Account is deactivated'
        ])
      }
    }
  },

  '/auth/logout': {
    post: {
      summary: 'Log out',
      description: `Blacklists the access token, revokes the refresh session and clears both cookies. ${AUTH_NOTE}`,
      tags: [authTag.name],
      responses: {
        200: successResponse({
          description: 'Both cookies were cleared on the response.',
          data: messageData('Logged out successfully'),
          example: successExample({ message: 'Logged out successfully' })
        }),
        400: errorResponse('One of the two cookies is missing', [
          'Access token and refresh token are required'
        ]),
        401: errorResponse(
          'A token does not verify or does not belong to the caller. The mismatched case revokes every session of that user.',
          ['Access token missing', 'Invalid access token', 'Invalid refresh token']
        ),
        403: errorResponse('The account was deactivated', [
          'Account is deactivated'
        ])
      }
    }
  },

  '/auth/google': {
    get: {
      summary: 'Start Google OAuth',
      description:
        'Redirects the browser to the Google consent screen and stores an anti-CSRF state cookie. Open it in a browser tab rather than through Test Request, which cannot follow a cross-origin redirect.',
      tags: [authTag.name],
      responses: {
        302: { description: 'Redirect to the Google consent screen' }
      }
    }
  },

  '/auth/google/callback': {
    get: {
      summary: 'Complete Google OAuth',
      description:
        'Callback hit by Google. It validates the state cookie, resolves or creates the user, sets the auth cookies, then redirects to FRONTEND_URL/auth/callback.',
      tags: [authTag.name],
      parameters: [
        { in: 'query', name: 'code', schema: { type: 'string' } },
        { in: 'query', name: 'state', schema: { type: 'string' } },
        {
          in: 'query',
          name: 'error',
          description: 'Set by Google when the user declined the consent.',
          schema: { type: 'string' }
        }
      ],
      responses: {
        302: {
          description:
            'Redirect to FRONTEND_URL/auth/callback, or to the same URL with ?error=... when Google refused'
        },
        400: errorResponse('Google came back without a code or a state', [
          'Missing authorization code or state'
        ]),
        401: errorResponse(
          'The state does not match the cookie, or the Google profile cannot be used',
          [
            'Invalid OAuth state',
            'Google did not return an id_token',
            'Cannot read profile from Google account',
            'Google email is not verified, cannot link account'
          ]
        ),
        403: errorResponse('The matching local account was deactivated', [
          'Account is deactivated'
        ])
      }
    }
  },

  '/auth/google/one-tap': {
    post: {
      summary: 'Sign in with Google One Tap',
      description:
        'Verifies the Google ID token issued by One Tap, links or creates the account, and sets the same cookies as the redirect flow. The example below only shows the shape: paste a real, unexpired credential before sending it.',
      tags: [authTag.name],
      requestBody: jsonBody(
        object(
          {
            credential: {
              type: 'string',
              description: 'Google ID token returned by One Tap'
            }
          },
          ['credential']
        ),
        {
          example: {
            credential:
              'eyJhbGciOiJSUzI1NiIsImtpZCI6IjBlMzQ1YyIsInR5cCI6IkpXVCJ9.PASTE_THE_GOOGLE_ID_TOKEN_HERE'
          }
        }
      ),
      responses: {
        200: successResponse({
          description: 'Signed in. Sets both auth cookies.',
          data: userData,
          example: successExample({
            user: {
              ...exampleUser,
              phone: null,
              auth_provider: 'google',
              avatar: 'https://lh3.googleusercontent.com/a/default-user'
            }
          })
        }),
        400: errorResponse('No credential in the body', [
          'Missing Google credential'
        ]),
        401: errorResponse('The credential does not verify', [
          'Cannot read profile from Google account',
          'Google email is not verified, cannot link account'
        ]),
        403: errorResponse('The matching local account was deactivated', [
          'Account is deactivated'
        ])
      }
    }
  }
}
