/**
 * User schemas.
 *
 * User is the self view returned to the authenticated owner; PublicUser is the
 * reduced view every other caller receives.
 *
 * The self view is the database row with password and deleted_at stripped, so
 * it carries google_id and auth_provider on top of the public fields.
 */

import type { SchemaMap } from '../types.js'

export const userSchemas: SchemaMap = {
  User: {
    type: 'object',
    description: 'The signed-in user, including private contact details.',
    properties: {
      id: { type: 'integer', example: 3 },
      fullname: { type: 'string', example: 'Nguyen Van A' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string', nullable: true },
      role: { type: 'string', enum: ['admin', 'moderator', 'user'] },
      avatar: { type: 'string', nullable: true },
      description: { type: 'string', nullable: true },
      google_id: {
        type: 'string',
        nullable: true,
        description: 'Set once the account is linked to Google.'
      },
      auth_provider: { type: 'string', enum: ['local', 'google'] },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' }
    }
  },

  PublicUser: {
    type: 'object',
    description: 'The public profile of a user, without phone or role.',
    properties: {
      id: { type: 'integer' },
      fullname: { type: 'string' },
      email: { type: 'string' },
      avatar: { type: 'string', nullable: true },
      description: { type: 'string', nullable: true }
    }
  }
}
