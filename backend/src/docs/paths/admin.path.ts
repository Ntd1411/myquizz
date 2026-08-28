/**
 * Admin endpoints: read the account list, ban an account, lift a ban.
 *
 * Statuses and codes are the ones admin.controller.ts, admin.service.ts and
 * admin.repository.ts actually produce.
 *
 * Two properties are shared by all three operations and stated once here. The role
 * check lives in the controller rather than in the router, so every operation answers
 * 403 FORBIDDEN for a signed-in caller who is not an admin. And both writes are
 * unconditional on the current deleted_at, so they are idempotent: a 404 from either
 * one means the id does not exist, never "the ban was already in that state".
 */

import { USER_STATUS_FILTERS } from '../../modules/admin/admin.schema.js'
import type { PathMap, TagObject } from '../types.js'
import {
  arrayOf,
  AUTH_NOTE,
  errorResponse,
  messageData,
  object,
  ref,
  successExample,
  successResponse,
  validationError
} from '../types.js'

export const adminTag: TagObject = {
  name: 'Admin',
  description:
    'Account moderation, admin role only: list accounts, ban one by soft deleting it, and lift the ban again.'
}

// Raised by authMiddleware before the controller runs, on every route of the module.
const unauthenticated = errorResponse('No usable accessToken cookie', [
  'AUTH_TOKEN_MISSING',
  'AUTH_TOKEN_INVALID'
])

/*
 * One status, two refusals with two codes: authMiddleware rejects a caller whose own
 * account was deactivated, the controller rejects a caller whose role is not admin. A
 * non-admin is deliberately not answered with 404: hiding the route would only make a
 * client retry it, and the code already says exactly what is missing.
 */
const notAdmin = errorResponse(
  'Signed in but not allowed to use this module: the role is not admin, or the calling account was itself deactivated',
  ['FORBIDDEN', 'USER_DEACTIVATED']
)

const accountNotFound = errorResponse(
  'No account carries that id. Both writes are idempotent, so this never means the account was already in the requested state.',
  ['USER_NOT_FOUND']
)

const idParameter = {
  in: 'path',
  name: 'id',
  required: true,
  description:
    'Account id. Validated before the handler runs, so a non-numeric id answers 400 instead of reaching the database as NaN.',
  schema: { type: 'integer', minimum: 1 },
  example: 42
}

const exampleActiveUser = {
  id: 42,
  fullname: 'Demo User',
  email: 'demo@myquizz.com',
  phone: null,
  role: 'user',
  avatar: null,
  deleted_at: null,
  created_at: '2026-08-11T21:09:24.744Z'
}

const exampleBannedUser = {
  id: 17,
  fullname: 'Banned Account',
  email: 'banned@myquizz.com',
  phone: null,
  role: 'user',
  avatar: null,
  deleted_at: '2026-08-12T02:40:11.108Z',
  created_at: '2026-08-05T09:12:03.221Z'
}

export const adminPaths: PathMap = {
  '/admin/users': {
    get: {
      summary: 'List accounts',
      description: `Lists accounts newest first, with the id as a tiebreaker so the order is total and a row cannot appear on two pages. Paging is offset based and the response reports offset, limit, total and the status it filtered on under meta.pagination; total is computed with that same filter, so it can never promise a page the listing will not produce. status decides what "the users" means, since a ban is a soft delete and both kinds of row live in the same table: all returns both, active only accounts that can sign in, banned only accounts under a ban, which is the view to review before lifting one. Every row carries deleted_at, the only field that tells the two apart. ${AUTH_NOTE}`,
      tags: [adminTag.name],
      parameters: [
        {
          in: 'query',
          name: 'offset',
          required: false,
          description: 'Rows to skip. 0 by default.',
          schema: { type: 'integer', minimum: 0, default: 0 },
          example: 0
        },
        {
          in: 'query',
          name: 'limit',
          required: false,
          description:
            'Rows per page, 1 to 100. 20 by default. The bound is enforced by the schema, so limit=0 and limit=abc are refused rather than silently replaced by the default.',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          example: 20
        },
        {
          in: 'query',
          name: 'status',
          required: false,
          description:
            'Which accounts to list: all of them, only the active ones, or only the banned ones.',
          schema: {
            type: 'string',
            enum: [...USER_STATUS_FILTERS],
            default: 'all'
          },
          example: 'all'
        }
      ],
      responses: {
        200: successResponse({
          description:
            'One page of accounts, with the paging state under meta.pagination.',
          data: object({ users: arrayOf('AdminUser') }, ['users']),
          meta: object({ pagination: ref('OffsetPagination') }, ['pagination']),
          example: successExample(
            { users: [exampleActiveUser, exampleBannedUser] },
            { pagination: { offset: 0, limit: 20, total: 137, status: 'all' } }
          )
        }),
        400: errorResponse(
          'offset, limit or status is outside what the schema accepts',
          [validationError({ limit: 'limit must be between 1 and 100' })]
        ),
        401: unauthenticated,
        403: notAdmin
      }
    }
  },

  '/admin/users/{id}': {
    delete: {
      summary: 'Ban an account',
      description: `Bans an account by stamping deleted_at, which is the same state a self-deactivated account ends in: every user lookup filters on deleted_at IS NULL, so the person can no longer sign in, while their quizzes and match history stay exactly where they are. Nothing is erased, which is what makes POST /admin/users/{id}/restore a real undo. The write is not conditional on the current deleted_at, so banning an already banned account succeeds instead of answering 404 to a retry. An admin cannot ban their own account: on a workspace with a single admin that would remove both the session and the role needed to lift the ban. ${AUTH_NOTE}`,
      tags: [adminTag.name],
      parameters: [idParameter],
      responses: {
        200: successResponse({
          description: 'The account is banned.',
          data: messageData('User banned successfully'),
          example: successExample({ message: 'User banned successfully' })
        }),
        400: errorResponse(
          'The id is not a positive integer, or an admin asked to ban their own account',
          ['ADMIN_CANNOT_BAN_SELF', validationError({ id: 'id must be a positive integer' })]
        ),
        401: unauthenticated,
        403: notAdmin,
        404: accountNotFound
      }
    }
  },

  '/admin/users/{id}/restore': {
    post: {
      summary: 'Lift a ban',
      description: `Clears deleted_at, after which the account can sign in again. It is a POST to a sub-resource rather than a second DELETE carrying a flag, so the destructive call and its undo cannot be confused for each other. There is no body. Like the ban, the write is unconditional, so restoring an account that was never banned succeeds and a 404 only ever means there is no such id. ${AUTH_NOTE}`,
      tags: [adminTag.name],
      parameters: [idParameter],
      responses: {
        200: successResponse({
          description: 'The ban is lifted.',
          data: messageData('User restored successfully'),
          example: successExample({ message: 'User restored successfully' })
        }),
        400: errorResponse('The id is not a positive integer', [
          validationError({ id: 'id must be a positive integer' })
        ]),
        401: unauthenticated,
        403: notAdmin,
        404: accountNotFound
      }
    }
  }
}
