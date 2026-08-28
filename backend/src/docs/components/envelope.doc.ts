/**
 * Response envelope and pagination schemas shared by every endpoint.
 *
 * The API always answers with { success, data, error, meta }, so these schemas
 * are the base every operation composes on instead of describing the wrapper
 * again on each route.
 *
 * There are three pagination shapes in the codebase. Two are keyset-based:
 * ListingPagination for search, /quizzes/me, the public profile and the play
 * history, and CursorPagination for the discovery feed. The third is
 * OffsetPagination, which belongs to the admin listing and is documented next
 * to it in components/admin.doc.ts: a cursor cannot express "page 4 of 12",
 * which is exactly what a moderation table needs.
 */

import { ERROR_CODES } from '../../shared/errors/codes.js'
import type { SchemaMap } from '../types.js'
import { EXAMPLE_TIMESTAMP, ref } from '../types.js'

export const envelopeSchemas: SchemaMap = {
  ApiMeta: {
    type: 'object',
    description:
      'Response metadata. timestamp is set on every response; pagination and cached only appear on the endpoints that produce them.',
    required: ['timestamp'],
    properties: {
      timestamp: {
        type: 'string',
        format: 'date-time',
        example: EXAMPLE_TIMESTAMP
      },
      pagination: {
        oneOf: [
          ref('ListingPagination'),
          ref('CursorPagination'),
          ref('OffsetPagination')
        ]
      },
      cached: {
        type: 'boolean',
        description: 'True when the response came from cache.',
        example: false
      }
    }
  },

  CursorPagination: {
    type: 'object',
    description:
      'Keyset paging state of the discovery feed (GET /quizzes/feed). It never carries a total.',
    required: ['limit', 'nextCursor', 'hasMore'],
    properties: {
      limit: { type: 'integer', example: 12 },
      nextCursor: {
        type: 'string',
        nullable: true,
        description:
          'Pass this back as cursor to fetch the next page. null means the last page was reached.',
        example: 'MC45ODc2fDEyMw'
      },
      hasMore: { type: 'boolean', example: true }
    }
  },

  ListingPagination: {
    type: 'object',
    description:
      'Keyset paging state of the listing endpoints (search, /quizzes/me, public profile, /games/history). total is present only when the request asked for it with include_total=true.',
    required: ['limit', 'nextCursor', 'hasMore'],
    properties: {
      limit: { type: 'integer', example: 12 },
      nextCursor: {
        type: 'string',
        nullable: true,
        description:
          'Pass this back as cursor to fetch the next page. null means the last page was reached.',
        example: 'djF8bmV3ZXN0fGExYjJjM2Q0fE1qQXlOaTB3T0Mwd09BfDQy'
      },
      hasMore: { type: 'boolean', example: true },
      total: { type: 'integer', example: 137 }
    }
  },

  SuccessEnvelope: {
    type: 'object',
    description:
      'Shape of every 2xx response. error is always null on success, and data is null when the endpoint has nothing to return.',
    required: ['success', 'data', 'error', 'meta'],
    properties: {
      success: { type: 'boolean', enum: [true], example: true },
      data: { type: 'object', nullable: true },
      error: { type: 'object', nullable: true, example: null },
      meta: ref('ApiMeta')
    }
  },

  ErrorEnvelope: {
    type: 'object',
    description:
      'Shape of every 4xx and 5xx response. data is always null and error carries a single machine-readable code. No sentence and no field dump is returned: the client owns the wording, which is what lets the same API serve a UI in any language, and the reason behind the refusal stays in the server log.',
    required: ['success', 'data', 'error', 'meta'],
    properties: {
      success: { type: 'boolean', enum: [false], example: false },
      data: { type: 'object', nullable: true, example: null },
      error: {
        type: 'object',
        required: ['code'],
        properties: {
          code: {
            type: 'string',
            description:
              'Names the situation, never the sentence. Match on this value: the list of codes an operation can answer with is documented on that operation, and VALIDATION_ERROR covers any body rejected by a schema. The enum below is the whole vocabulary, generated from shared/errors/codes.ts, so it cannot drift from what the server can send. See the Error codes section of the introduction for what each one means.',
            enum: [...ERROR_CODES],
            example: 'QUIZ_NOT_FOUND'
          }
        }
      },
      meta: ref('ApiMeta')
    }
  }
}
