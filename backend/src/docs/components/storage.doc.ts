/**
 * Storage schemas for the presigned direct-upload flow.
 */

import type { SchemaMap } from '../types.js'

export const storageSchemas: SchemaMap = {
  PresignResult: {
    type: 'object',
    properties: {
      uploadUrl: {
        type: 'string',
        description: 'PUT the binary here within 5 minutes'
      },
      publicUrl: { type: 'string' },
      key: {
        type: 'string',
        description: 'object key, format {folder}/{userId}/{uuid}'
      }
    }
  }
}
