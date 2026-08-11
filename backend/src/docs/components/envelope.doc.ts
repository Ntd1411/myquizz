/**
 * Response envelope and pagination schemas shared by every endpoint.
 *
 * The API always answers with { success, data, error, meta }, so these schemas
 * are the base every operation composes on instead of describing the wrapper
 * again on each route.
 *
 * There are exactly two pagination shapes in the codebase, both keyset-based:
 * ListingPagination for search, /quizzes/me and the public profile, and
 * CursorPagination for the discovery feed. No endpoint returns page/offset
 * paging, so no such schema is documented.
 */

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
        oneOf: [ref('ListingPagination'), ref('CursorPagination')]
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
      'Keyset paging state of the listing endpoints (search, /quizzes/me, public profile). total is present only when the request asked for it with include_total=true.',
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
      'Shape of every 4xx and 5xx response. data is always null, and details only carries a value for validation failures, where it maps each rejected field to its reason.',
    required: ['success', 'data', 'error', 'meta'],
    properties: {
      success: { type: 'boolean', enum: [false], example: false },
      data: { type: 'object', nullable: true, example: null },
      error: {
        type: 'object',
        required: ['message', 'details'],
        properties: {
          message: { type: 'string', example: 'Quiz not found' },
          details: {
            type: 'object',
            nullable: true,
            description:
              'Field-by-field reasons on a validation error, null otherwise.',
            additionalProperties: { type: 'string' },
            example: null
          }
        }
      },
      meta: ref('ApiMeta')
    }
  }
}
