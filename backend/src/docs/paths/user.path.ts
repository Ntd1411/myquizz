/**
 * User endpoints: self profile, public profile, password flows and avatar.
 *
 * The avatar route takes JSON, not multipart: the client uploads the binary
 * straight to object storage through /storage/presign and then sends the
 * resulting public URL here.
 *
 * Status codes and error messages are the ones user.controller.ts and
 * user.service.ts actually produce. Note that a wrong old password is a 400
 * and not a 403, while a wrong password on account deletion is a 403.
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

export const userTag: TagObject = {
  name: 'Users',
  description:
    'Read and update the signed-in account, read a public profile, and run the password and avatar flows.'
}

// Raised by authMiddleware before the controller runs, on every protected route.
const unauthenticated = errorResponse('No usable accessToken cookie', [
  'Access token missing',
  'Token is blacklisted',
  'Invalid access token'
])

const deactivated = errorResponse('The account was deactivated', [
  'Account is deactivated'
])

const exampleUser = {
  id: 3,
  fullname: 'Demo User',
  email: 'demo@myquizz.com',
  phone: '0912345678',
  role: 'user',
  avatar: null,
  description: 'Quiz author and occasional host.',
  google_id: null,
  auth_provider: 'local',
  created_at: '2026-08-11T21:09:24.744Z',
  updated_at: '2026-08-12T02:40:11.108Z'
}

export const userPaths: PathMap = {
  '/users/me': {
    get: {
      summary: 'Retrieve the current user',
      description: `Returns the signed-in account, including the private contact details. The row comes straight from the session, so it never hits the database. ${AUTH_NOTE}`,
      tags: [userTag.name],
      responses: {
        200: successResponse({
          description: 'The signed-in user.',
          data: object({ user: ref('User') }, ['user']),
          example: successExample({ user: exampleUser })
        }),
        401: unauthenticated,
        403: deactivated
      }
    },
    patch: {
      summary: 'Update the current user',
      description: `Partially updates the signed-in profile. Only truthy fields are written, so an empty string clears nothing and is treated as absent, with one exception: an empty phone clears the stored number. A body that carries no writable field answers 400. The email cannot be changed and is not accepted: Google sign-in falls back to matching an account by address, so an edited email would strand the profile and create a duplicate on the next sign-in. The body is strict, so sending an email key answers 400 instead of being silently ignored. The uniqueness check on phone looks at every account including your own, so resending your current phone answers 400 as well. The row returned is read back from the database after the write. ${AUTH_NOTE}`,
      tags: [userTag.name],
      requestBody: jsonBody(
        object({
          fullname: { type: 'string', minLength: 2, maxLength: 100 },
          phone: { type: 'string', description: '7-15 digits, or empty to clear the number' },
          description: { type: 'string', maxLength: 200 }
        }),
        {
          example: {
            fullname: 'Demo User',
            description: 'Quiz author and occasional host.'
          }
        }
      ),
      responses: {
        200: successResponse({
          description: 'The profile after the update.',
          data: object({ user: ref('User') }, ['user']),
          example: successExample({ user: exampleUser })
        }),
        400: errorResponse(
          'Nothing to write, the body carries a field that cannot be edited, or the new phone belongs to somebody else',
          [
            'No fields to update',
            'Phone number is already in use',
            validationError({ email: 'Unrecognized key: "email"' }),
            validationError({ phone: 'Phone must be 7-15 digits' }),
            validationError({
              description: 'Description must be at most 200 characters'
            })
          ]
        ),
        401: unauthenticated,
        403: deactivated,
        500: errorResponse('The row could not be written', [
          'Failed to update profile'
        ])
      }
    },
    delete: {
      summary: 'Delete the current user',
      description: `Deactivates the account rather than erasing it: the row keeps its data and gets a deleted_at stamp, after which every authenticated call answers 403. The current password is required to confirm, so Google-only accounts cannot use this route. ${AUTH_NOTE}`,
      tags: [userTag.name],
      requestBody: jsonBody(
        object(
          { password: { type: 'string', format: 'password', minLength: 8 } },
          ['password']
        ),
        { example: { password: 'Password123!' } }
      ),
      responses: {
        200: successResponse({
          description: 'The account is deactivated.',
          data: messageData('Account deactivated successfully'),
          example: successExample({
            message: 'Account deactivated successfully'
          })
        }),
        400: errorResponse(
          'The body is missing a password, or the account has none because it was created through Google',
          [
            'Password is required to deactivate account',
            'Cannot deactivate your account',
            validationError({
              password: 'Password must be at least 8 characters'
            })
          ]
        ),
        401: unauthenticated,
        403: errorResponse(
          'The password does not match, or the account is already deactivated',
          ['Invalid credentials', 'Account is deactivated']
        ),
        500: errorResponse('The row could not be written', [
          'Failed to deactivate account'
        ])
      }
    }
  },

  '/users/{userId}': {
    get: {
      summary: 'Retrieve a user',
      description:
        'Returns the public profile of any account: id, fullname, email, avatar and description, never the phone or the role. This route runs no authentication. A deactivated account answers 410 rather than 404, so a client can tell a gone profile from one that never existed.',
      tags: [userTag.name],
      parameters: [
        {
          in: 'path',
          name: 'userId',
          required: true,
          schema: { type: 'integer', minimum: 1 },
          example: 3
        }
      ],
      responses: {
        200: successResponse({
          description: 'The public profile.',
          data: object({ user: ref('PublicUser') }, ['user']),
          example: successExample({
            user: {
              id: 3,
              fullname: 'Demo User',
              email: 'demo@myquizz.com',
              avatar: null,
              description: 'Quiz author and occasional host.'
            }
          })
        }),
        400: errorResponse('userId is not a positive integer', [
          'Invalid user ID'
        ]),
        404: errorResponse('No account with that id', ['User not found']),
        410: errorResponse('The account exists but was deactivated', [
          'Account is deactivated'
        ])
      }
    }
  },

  '/users/me/password': {
    patch: {
      summary: 'Update the password',
      description: `Changes the password of the signed-in account. The old password is required, the new one must differ from it, and a wrong old password answers 400 rather than 403. This route is rate limited. ${AUTH_NOTE}`,
      tags: [userTag.name],
      requestBody: jsonBody(
        object(
          {
            oldPassword: { type: 'string', minLength: 8 },
            newPassword: { type: 'string', minLength: 8 }
          },
          ['oldPassword', 'newPassword']
        ),
        {
          example: {
            oldPassword: 'Password123!',
            newPassword: 'NewPassword456!'
          }
        }
      ),
      responses: {
        200: successResponse({
          description: 'The password was replaced.',
          data: messageData('Password changed successfully'),
          example: successExample({ message: 'Password changed successfully' })
        }),
        400: errorResponse(
          'Missing field, wrong old password, unchanged password, or an account that has no password at all',
          [
            'Old password and new password are required',
            'Old password is incorrect',
            'New password must be different from the old password',
            'User does not have a password set',
            validationError({
              newPassword: 'Password must be at least 8 characters'
            })
          ]
        ),
        401: unauthenticated,
        403: deactivated,
        429: errorResponse(
          'authRateLimiter: 5 requests per IP per 5 minutes, successful changes excluded.',
          ['Too many requests. Please try again in 240 seconds']
        ),
        500: errorResponse('The row could not be written', [
          'Failed to change password'
        ])
      }
    }
  },

  '/users/me/avatar': {
    patch: {
      summary: 'Update the avatar',
      description: `Takes JSON, not multipart. Upload the image through POST /storage/presign with folder=avatars, PUT the binary to the returned uploadUrl, then send the returned publicUrl here as fileUrl. The previous avatar is deleted from object storage. ${AUTH_NOTE}`,
      tags: [userTag.name],
      requestBody: jsonBody(
        object({ fileUrl: { type: 'string', format: 'uri' } }, ['fileUrl']),
        {
          example: {
            fileUrl:
              'https://cdn.example.com/avatars/3/6f1d5b1e-6f7c-4f0e-9a1c-2d3f4a5b6c7d'
          }
        }
      ),
      responses: {
        200: successResponse({
          description:
            'The stored URL, echoed back as avatarUrl rather than as a full user row.',
          data: object({ avatarUrl: { type: 'string', format: 'uri' } }, [
            'avatarUrl'
          ]),
          example: successExample({
            avatarUrl:
              'https://cdn.example.com/avatars/3/6f1d5b1e-6f7c-4f0e-9a1c-2d3f4a5b6c7d'
          })
        }),
        400: errorResponse('The body carries no fileUrl', [
          'No file uploaded'
        ]),
        401: unauthenticated,
        403: deactivated,
        404: errorResponse('The session points at a row that is gone', [
          'User not found'
        ]),
        500: errorResponse('The row could not be written', [
          'Failed to upload avatar'
        ])
      }
    }
  },

  '/users/forgot-password': {
    post: {
      summary: 'Send a password reset code',
      description:
        'Emails a six-digit code and a reset link, both valid for 2 minutes. The answer carries two instants: data.resetTime is when the next code may be requested, one minute after the send, and data.expiresAt is when the current code and link stop working. Asking again inside that first minute is not an error and sends nothing, it simply repeats the deadlines of the code already outstanding. Accounts created through Google have no password to reset.',
      tags: [userTag.name],
      requestBody: jsonBody(
        object({ email: { type: 'string', format: 'email' } }, ['email']),
        { example: { email: 'demo@myquizz.com' } }
      ),
      responses: {
        200: successResponse({
          description:
            'The code was queued for delivery, or one was already outstanding. data.resetTime says when the next request is allowed, data.expiresAt when the current code dies.',
          data: object(
            {
              resetTime: { type: 'string', format: 'date-time' },
              expiresAt: { type: 'string', format: 'date-time' }
            },
            ['resetTime', 'expiresAt']
          ),
          example: successExample({
            resetTime: '2026-08-12T03:01:00.000Z',
            expiresAt: '2026-08-12T03:02:00.000Z'
          })
        }),
        400: errorResponse('The account signs in with Google', [
          'Email is required',
          'Google account cannot reset password'
        ]),
        404: errorResponse('No account with that email', ['Email not found']),
        410: errorResponse('The account was deactivated', [
          'Account is deactivated'
        ]),
        429: errorResponse(
          'The IP hit authRateLimiter (5 requests per 5 minutes, successful sends excluded). A code that is still valid is no longer an error: it answers 200 carrying the deadlines of the outstanding code.',
          ['Too many requests. Please try again in 240 seconds']
        )
      }
    }
  },

  '/users/reset-password': {
    post: {
      summary: 'Reset the password with a code',
      description:
        'Completes the reset started by POST /users/forgot-password, using the six-digit code from the email. The code, the matching link token and the resend cooldown are all dropped afterwards.',
      tags: [userTag.name],
      requestBody: jsonBody(
        object(
          {
            email: { type: 'string', format: 'email' },
            otp: { type: 'string', minLength: 6, maxLength: 6 },
            newPassword: { type: 'string', minLength: 8 }
          },
          ['email', 'otp', 'newPassword']
        ),
        {
          example: {
            email: 'demo@myquizz.com',
            otp: '482913',
            newPassword: 'NewPassword456!'
          }
        }
      ),
      responses: {
        200: successResponse({
          description: 'The password was replaced.',
          data: messageData('Password reset successfully'),
          example: successExample({ message: 'Password reset successfully' })
        }),
        400: errorResponse('Missing field, or a code that expired or is wrong', [
          'Email, OTP and new password are required',
          'OTP expired or not found',
          'Invalid OTP',
          validationError({ otp: 'OTP must be 6 digits' })
        ]),
        404: errorResponse('No account with that email', ['User not found']),
        429: errorResponse(
          'resetPasswordRateLimiter: 5 requests per IP per 10 minutes. Rejected attempts are not charged, so only completed resets add up.',
          ['Too many requests. Please try again in 420 seconds']
        ),
        500: errorResponse('The row could not be written', [
          'Failed to reset password'
        ])
      }
    }
  },

  '/users/reset-password-token': {
    post: {
      summary: 'Reset the password with a token',
      description:
        'Completes the reset using the token embedded in the emailed link instead of the six-digit code. Same 2-minute window, and using it also invalidates the code and the resend cooldown.',
      tags: [userTag.name],
      requestBody: jsonBody(
        object(
          {
            token: { type: 'string', minLength: 1 },
            newPassword: { type: 'string', minLength: 8 }
          },
          ['token', 'newPassword']
        ),
        {
          example: {
            token: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
            newPassword: 'NewPassword456!'
          }
        }
      ),
      responses: {
        200: successResponse({
          description: 'The password was replaced.',
          data: messageData('Password reset successfully'),
          example: successExample({ message: 'Password reset successfully' })
        }),
        400: errorResponse('Missing field, or a token that expired', [
          'Token and new password are required',
          'Reset token expired or invalid',
          validationError({ token: 'Token is required' })
        ]),
        404: errorResponse('No account behind that token', ['User not found']),
        429: errorResponse(
          'resetPasswordRateLimiter: 5 requests per IP per 10 minutes. Rejected attempts are not charged, so only completed resets add up.',
          ['Too many requests. Please try again in 420 seconds']
        ),
        500: errorResponse('The row could not be written', [
          'Failed to reset password'
        ])
      }
    }
  }
}
