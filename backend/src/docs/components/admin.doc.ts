/**
 * Admin schemas.
 *
 * AdminUser is a third view of the users table, next to User and PublicUser. It drops
 * the credentials and keeps deleted_at, because telling a banned account from a live
 * one is the entire purpose of the listing.
 *
 * OffsetPagination lives here rather than in envelope.doc.ts even though ApiMeta
 * points at it: it describes one endpoint, and keeping it next to that endpoint lets
 * the status enum be imported from the schema that enforces it instead of being
 * retyped. ApiMeta references it by name, which is enough - every schema map is merged
 * into one components.schemas.
 */

import { USER_STATUS_FILTERS } from '../../modules/admin/admin.schema.js'
import type { SchemaMap } from '../types.js'

export const adminSchemas: SchemaMap = {
  AdminUser: {
    type: 'object',
    description:
      'An account as the admin listing exposes it: the moderation fields and nothing else. password and google_id are never selected, and description, auth_provider and updated_at are left out because no moderation decision reads them.',
    properties: {
      id: { type: 'integer', example: 42 },
      fullname: { type: 'string', example: 'Demo User' },
      email: { type: 'string', format: 'email', example: 'demo@myquizz.com' },
      phone: { type: 'string', nullable: true, example: null },
      role: {
        type: 'string',
        enum: ['admin', 'moderator', 'user'],
        example: 'user'
      },
      avatar: { type: 'string', nullable: true, example: null },
      deleted_at: {
        type: 'string',
        format: 'date-time',
        nullable: true,
        description:
          'When the account was banned, null while it is active. This is the only banned/active signal in the payload, so match on it rather than on the presence of the row: status=all returns both kinds.',
        example: null
      },
      created_at: { type: 'string', format: 'date-time' }
    }
  },

  OffsetPagination: {
    type: 'object',
    description:
      'Paging state of GET /admin/users, the one endpoint that pages by offset instead of a cursor. A moderation table has to jump to an arbitrary page and say how many accounts match, neither of which a keyset cursor can express. total is always present, and always counts the same status the listing filtered on, so the pager cannot be told there are pages it can never reach.',
    required: ['offset', 'limit', 'total', 'status'],
    properties: {
      offset: { type: 'integer', example: 0 },
      limit: { type: 'integer', example: 20 },
      total: { type: 'integer', example: 137 },
      status: {
        type: 'string',
        enum: [...USER_STATUS_FILTERS],
        description: 'The filter that was applied, echoed back.',
        example: 'all'
      }
    }
  }
}
