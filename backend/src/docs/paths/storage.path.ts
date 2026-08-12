/**
 * Storage endpoint for presigned direct-to-object-storage uploads.
 *
 * Status codes and error messages are the ones storage.controller.ts and
 * storage.service.ts actually produce.
 */

import type { PathMap, TagObject } from '../types.js'
import {
  AUTH_NOTE,
  errorResponse,
  jsonBody,
  object,
  ref,
  successExample,
  successResponse,
  validationError
} from '../types.js'

export const storageTag: TagObject = {
  name: 'Storage',
  description:
    'Presigned URLs for uploading images straight to object storage.'
}

export const storagePaths: PathMap = {
  '/storage/presign': {
    post: {
      summary: 'Create a presigned upload URL',
      description: `Returns a URL to PUT the binary to. The URL is valid for 5 minutes, the object key is {folder}/{userId}/{uuid} with no extension appended, and the file may not exceed 2MB. Send the returned publicUrl to whichever endpoint stores the reference, such as PATCH /users/me/avatar. This route is rate limited to 20 successful presigns per 10 minutes, counted per user and IP together. ${AUTH_NOTE}`,
      tags: [storageTag.name],
      requestBody: jsonBody(
        object(
          {
            contentType: {
              type: 'string',
              enum: [
                'image/jpeg',
                'image/jpg',
                'image/png',
                'image/gif',
                'image/webp'
              ]
            },
            folder: {
              type: 'string',
              enum: ['avatars', 'quizzes', 'questions', 'uploads']
            },
            fileSize: {
              type: 'number',
              minimum: 1,
              maximum: 2097152,
              description: 'Size in bytes, 2MB at most.'
            }
          },
          ['contentType', 'folder', 'fileSize']
        ),
        {
          example: {
            contentType: 'image/png',
            folder: 'avatars',
            fileSize: 245760
          }
        }
      ),
      responses: {
        200: successResponse({
          description: 'The result is nested under data.presignedUrl.',
          data: object({ presignedUrl: ref('PresignResult') }, [
            'presignedUrl'
          ]),
          example: successExample({
            presignedUrl: {
              uploadUrl:
                'https://storage.example.com/myquizz/avatars/3/6f1d5b1e-6f7c-4f0e-9a1c-2d3f4a5b6c7d?X-Amz-Expires=300&X-Amz-Signature=REDACTED',
              publicUrl:
                'https://cdn.example.com/avatars/3/6f1d5b1e-6f7c-4f0e-9a1c-2d3f4a5b6c7d',
              key: 'avatars/3/6f1d5b1e-6f7c-4f0e-9a1c-2d3f4a5b6c7d'
            }
          })
        }),
        400: errorResponse(
          'Rejected body. validateBody runs before the controller, so a malformed body comes back as a Validation error; the controller sentences below only remain reachable if the schema is bypassed.',
          [
            validationError({ fileSize: 'fileSize must not exceed 2MB' }),
            validationError({
              folder:
                'Invalid option: expected one of "avatars"|"quizzes"|"questions"|"uploads"'
            }),
            'contentType, folder and fileSize are required',
            'Invalid folder. Allowed: avatars, quizzes, questions, uploads',
            'File size exceeds 2MB limit'
          ]
        ),
        401: errorResponse('No usable accessToken cookie', [
          'Access token missing',
          'Token is blacklisted',
          'Invalid access token'
        ]),
        403: errorResponse('The account was deactivated', [
          'Account is deactivated'
        ]),
        429: errorResponse(
          'uploadRateLimiter rejected the call: more than 20 successful presigns in 10 minutes for this user and IP. The response carries X-RateLimit-* and Retry-After headers, and the number in the message is the remaining window in seconds.',
          ['Too many requests. Please try again in 420 seconds']
        )
      }
    }
  }
}
