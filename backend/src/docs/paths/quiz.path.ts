/**
 * Quiz endpoints: authoring, listing and discovery.
 *
 * Two different pagination shapes appear here and are documented per endpoint
 * rather than globally: the listing endpoints (search, /me, public profile)
 * report a ListingPagination whose total is only computed on demand, the feed
 * reports a CursorPagination that never carries a total, and /home reports no
 * pagination at all because it returns fixed-size sections.
 *
 * A quiz the caller may not read answers 404 and never 403: the service treats
 * private quizzes as non-existent so the endpoint cannot be used to probe which
 * ids exist.
 *
 * Status codes and error messages are the ones quiz.controller.ts,
 * listing.controller.ts, home.controller.ts and quiz.service.ts produce.
 */

import type { OpenApiObject, PathMap, TagObject } from '../types.js'
import {
  arrayOf,
  AUTH_NOTE,
  errorResponse,
  jsonBody,
  object,
  OPTIONAL_AUTH_NOTE,
  ref,
  successResponse,
  validationError
} from '../types.js'

export const quizTag: TagObject = {
  name: 'Quizzes',
  description:
    'Author quizzes and browse them: keyset-paginated listings, the home sections and the discovery feed.'
}

// Raised by authMiddleware before the controller runs, on the authoring routes.
const unauthenticated = errorResponse('No usable accessToken cookie', [
  'AUTH_TOKEN_MISSING',
  'AUTH_TOKEN_INVALID'
])

const deactivated = errorResponse('The account was deactivated', [
  'USER_DEACTIVATED'
])

const quizData = object({ quiz: ref('Quiz') }, ['quiz'])

// The three listing endpoints return QuizSummary rows, which are QuizCards
// plus is_public and updated_at. Only the feed and the home sections return
// plain QuizCards.
const quizSummariesData = object({ quizzes: arrayOf('QuizSummary') }, [
  'quizzes'
])

const quizCardsData = object({ quizzes: arrayOf('QuizCard') }, ['quizzes'])

// meta of the keyset-paginated listings. total only appears with include_total.
const listingMeta = object({ pagination: ref('ListingPagination') }, [
  'pagination'
])

// meta of the feed: same keyset paging, plus the cache flag, and never a total.
const feedMeta = object(
  {
    pagination: ref('CursorPagination'),
    cached: { type: 'boolean', example: false }
  },
  ['pagination', 'cached']
)

// meta of /home: fixed-size sections, so there is nothing to paginate.
const cachedMeta = object({ cached: { type: 'boolean', example: false } }, [
  'cached'
])

const cursorParam = (description: string): OpenApiObject => ({
  in: 'query',
  name: 'cursor',
  description,
  schema: { type: 'string' }
})

const limitParam: OpenApiObject = {
  in: 'query',
  name: 'limit',
  description: 'Rows per page, 1 to 24. Defaults to 12.',
  schema: { type: 'integer', minimum: 1, maximum: 24, default: 12 }
}

const includeTotalParam: OpenApiObject = {
  in: 'query',
  name: 'include_total',
  description:
    'Set to true to also count the whole result set into meta.pagination.total. It costs an extra query, so it is off by default and usually only worth it on the first page. The schema accepts the literal strings true and false only, so 1 or yes is a 400.',
  schema: { type: 'string', enum: ['true', 'false'], default: 'false' }
}

const quizIdParam: OpenApiObject = {
  in: 'path',
  name: 'quizId',
  required: true,
  schema: { type: 'integer', minimum: 1 },
  example: 1
}

// decodeListCursor throws this plain message for every failure: bad base64, a
// wrong version prefix, a sort or filter set that no longer matches the current
// request, or a primary value whose type does not fit the sort.
const invalidCursor = 'QUIZ_CURSOR_INVALID'

// The feed has its own cursor format, and its own message.
const invalidFeedCursor = 'QUIZ_CURSOR_INVALID'

export const quizPaths: PathMap = {
  '/quizzes': {
    post: {
      summary: 'Create a quiz',
      description: `Creates a quiz and its questions in one call; the quiz and its questions are written together, so a failure halfway leaves nothing behind. A quiz needs at least one question, and images are URLs obtained from POST /storage/presign. ${AUTH_NOTE}`,
      tags: [quizTag.name],
      requestBody: jsonBody(ref('CreateQuizRequest'), {
        examples: {
          multipleChoice: {
            summary: 'Multiple choice',
            value: {
              quiz_name: 'World Capitals',
              quiz_description: 'A short geography warm-up.',
              quiz_language: 'en',
              quiz_category: 'Geography',
              is_public: true,
              questions: [
                {
                  question_text: 'What is the capital of France?',
                  question_type: 'multiple_choice',
                  time_limit: 30,
                  answer_options: ['Paris', 'Lyon', 'Marseille', 'Toulouse'],
                  correct_answer: [0]
                }
              ]
            }
          },
          shortAnswer: {
            summary: 'Short answer',
            value: {
              quiz_name: 'Quick Maths',
              quiz_description: 'Type the answer, no options given.',
              quiz_language: 'en',
              quiz_category: 'Science',
              is_public: false,
              questions: [
                {
                  question_text: 'What is 12 x 12?',
                  question_type: 'short_answer',
                  time_limit: 20,
                  correct_answer: '144'
                }
              ]
            }
          }
        }
      }),
      responses: {
        201: successResponse({
          description: 'The quiz, with the stored questions.',
          data: quizData
        }),
        400: errorResponse('Rejected payload or a quiz without questions', [
          'QUIZ_NO_QUESTIONS',
          validationError({ quiz_name: 'Quiz name at least 3 chars' })
        ]),
        401: unauthenticated,
        403: deactivated,
        500: errorResponse('The rows could not be written', ['SERVER_ERROR'])
      }
    }
  },

  '/quizzes/search': {
    get: {
      summary: 'Search quizzes',
      description: `Full-text search over public quizzes, keyset paginated. The cursor is bound to the query, the filters and the sort that produced it, so changing any of them mid-pagination is a 400 rather than a page from another result set. ${OPTIONAL_AUTH_NOTE}`,
      tags: [quizTag.name],
      parameters: [
        {
          in: 'query',
          name: 'keyword',
          description:
            'Search terms matched against the quiz name and description. Trimmed, 200 characters at most.',
          schema: { type: 'string', maxLength: 200 },
          example: 'capitals'
        },
        {
          in: 'query',
          name: 'language',
          schema: { type: 'string', maxLength: 50 },
          example: 'en'
        },
        {
          in: 'query',
          name: 'category',
          schema: { type: 'string', maxLength: 100 },
          example: 'Geography'
        },
        {
          in: 'query',
          name: 'created_from',
          description:
            'Inclusive lower bound on the creation date, widened to the start of that day.',
          schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          example: '2026-01-01'
        },
        {
          in: 'query',
          name: 'created_to',
          description:
            'Inclusive upper bound on the creation date, widened to the end of that day. It may not be earlier than created_from.',
          schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          example: '2026-12-31'
        },
        {
          in: 'query',
          name: 'min_questions',
          schema: { type: 'integer', minimum: 0 }
        },
        {
          in: 'query',
          name: 'min_plays',
          schema: { type: 'integer', minimum: 0 }
        },
        {
          in: 'query',
          name: 'owner_id',
          description: 'Restrict the search to one author.',
          schema: { type: 'integer', minimum: 1 }
        },
        {
          in: 'query',
          name: 'mine',
          description:
            'Search your own quizzes instead, private ones included. It needs a session: sending true while anonymous is a 400. Only the literal strings true and false are accepted.',
          schema: { type: 'string', enum: ['true', 'false'], default: 'false' }
        },
        {
          in: 'query',
          name: 'sort',
          description:
            'No default: the service picks relevance when keyword is set and newest otherwise. Asking for relevance without a keyword degrades to newest instead of failing.',
          schema: {
            type: 'string',
            enum: [
              'relevance',
              'newest',
              'oldest',
              'name_asc',
              'name_desc',
              'most_played',
              'trending'
            ]
          }
        },
        limitParam,
        cursorParam(
          'meta.pagination.nextCursor of the previous page. It encodes the viewer, the filters and the sort, so they must stay unchanged.'
        ),
        includeTotalParam
      ],
      responses: {
        200: successResponse({
          description:
            'A page of matches. meta.pagination.nextCursor is null on the last page.',
          data: quizSummariesData,
          meta: listingMeta
        }),
        400: errorResponse(
          'The cursor does not belong to the current query, a parameter is out of range, the date range is inverted, or mine was requested without a session',
          [
            invalidCursor,
            'QUIZ_AUTH_REQUIRED',
            validationError({
              created_from: 'created_from must not be after created_to'
            })
          ]
        )
      }
    }
  },

  '/quizzes/me': {
    get: {
      summary: 'List your quizzes',
      description: `The quizzes owned by the signed-in account, private ones included, most recently updated first and keyset paginated. ${AUTH_NOTE}`,
      tags: [quizTag.name],
      parameters: [
        {
          in: 'query',
          name: 'visibility',
          schema: {
            type: 'string',
            enum: ['all', 'public', 'private'],
            default: 'all'
          }
        },
        {
          in: 'query',
          name: 'keyword',
          description: 'Trimmed, 200 characters at most.',
          schema: { type: 'string', maxLength: 200 }
        },
        {
          in: 'query',
          name: 'sort',
          schema: {
            type: 'string',
            enum: ['recently_updated', 'newest', 'oldest', 'name_asc'],
            default: 'recently_updated'
          }
        },
        limitParam,
        cursorParam('meta.pagination.nextCursor of the previous page.'),
        includeTotalParam
      ],
      responses: {
        200: successResponse({
          description: 'A page of the caller own quizzes.',
          data: quizSummariesData,
          meta: listingMeta
        }),
        400: errorResponse('The cursor does not decode', [invalidCursor]),
        401: unauthenticated,
        403: deactivated
      }
    }
  },

  '/quizzes/home': {
    get: {
      summary: 'List the home sections',
      description: `Everything the home screen needs in one call: featured, continue playing, trending, newest and per-category rows. Each section is a fixed-size row, so this endpoint has no pagination at all; use the feed to keep scrolling. Responses are cached, and meta.cached says whether this one came from the cache. ${OPTIONAL_AUTH_NOTE} The continue section is only present for a signed-in caller.`,
      tags: [quizTag.name],
      responses: {
        200: successResponse({
          description: 'The ordered sections of the home screen.',
          data: object({ sections: arrayOf('HomeSection') }, ['sections']),
          meta: cachedMeta
        })
      }
    }
  },

  '/quizzes/feed': {
    get: {
      summary: 'List the discovery feed',
      description: `The endless list under the home sections, keyset paginated and cached. Unlike the listing endpoints it never reports a total, because the feed is meant to be scrolled rather than counted. ${OPTIONAL_AUTH_NOTE}`,
      tags: [quizTag.name],
      parameters: [
        {
          in: 'query',
          name: 'topic',
          description: 'Narrows the feed to one topic. Trimmed, 50 characters at most.',
          schema: { type: 'string', maxLength: 50 },
          example: 'Geography'
        },
        limitParam,
        cursorParam(
          'meta.pagination.nextCursor of the previous page, 200 characters at most.'
        )
      ],
      responses: {
        200: successResponse({
          description:
            'A page of the feed. meta.pagination has no total by design.',
          data: quizCardsData,
          meta: feedMeta
        }),
        400: errorResponse('The cursor does not decode', [invalidFeedCursor])
      }
    }
  },

  '/quizzes/users/id/{ownerId}': {
    get: {
      summary: 'List a user\'s quizzes',
      description:
        'The public quizzes of one author, newest first and keyset paginated. This route runs no authentication, so private quizzes are never included, not even for the owner: use GET /quizzes/me for those.',
      tags: [quizTag.name],
      parameters: [
        {
          in: 'path',
          name: 'ownerId',
          required: true,
          schema: { type: 'integer', minimum: 1 },
          example: 3
        },
        {
          in: 'query',
          name: 'sort',
          schema: {
            type: 'string',
            enum: ['newest', 'oldest', 'most_played', 'name_asc'],
            default: 'newest'
          }
        },
        limitParam,
        cursorParam('meta.pagination.nextCursor of the previous page.'),
        includeTotalParam
      ],
      responses: {
        200: successResponse({
          description:
            'A page of that author public quizzes. An author who published nothing answers 200 with an empty page rather than 404.',
          data: quizSummariesData,
          meta: listingMeta
        }),
        400: errorResponse(
          'ownerId is not a positive integer, or the cursor does not decode',
          [
            validationError({
              ownerId: 'Too small: expected number to be >=1'
            }),
            invalidCursor
          ]
        ),
        404: errorResponse('No account with that id, or a deactivated one', [
          'USER_NOT_FOUND'
        ])
      }
    }
  },

  '/quizzes/id/{quizId}': {
    get: {
      summary: 'Retrieve a quiz',
      description: `The full quiz with its questions, used by the editor and by the host before opening a session. ${OPTIONAL_AUTH_NOTE} A private quiz is only readable by its owner and answers 404 to everybody else, so this endpoint cannot be used to find out which ids exist.`,
      tags: [quizTag.name],
      parameters: [quizIdParam],
      responses: {
        200: successResponse({
          description: 'The quiz and its questions.',
          data: quizData
        }),
        404: errorResponse(
          'No such quiz, or a private one the caller does not own',
          ['QUIZ_NOT_FOUND']
        )
      }
    },
    patch: {
      summary: 'Update a quiz',
      description: `Partially updates a quiz. Sending questions replaces the whole list rather than merging it, so send them all or leave the field out. Only the owner may edit, and for anybody else the quiz simply does not exist. ${AUTH_NOTE}`,
      tags: [quizTag.name],
      parameters: [quizIdParam],
      requestBody: jsonBody(ref('UpdateQuizRequest'), {
        example: {
          quiz_name: 'World Capitals (revised)',
          quiz_description:
            'A short geography warm-up, now with harder questions.',
          quiz_category: 'Geography',
          is_public: true,
          questions: [
            {
              question_text: 'What is the capital of Australia?',
              question_type: 'multiple_choice',
              time_limit: 30,
              answer_options: ['Canberra', 'Sydney', 'Melbourne', 'Perth'],
              correct_answer: [0]
            }
          ]
        }
      }),
      responses: {
        200: successResponse({
          description: 'The quiz after the update.',
          data: quizData
        }),
        400: errorResponse('Empty patch, or a question list that is empty', [
          'QUIZ_NO_QUESTIONS',
          validationError({
            'questions.0.answer_options': 'At least 2 options required'
          })
        ]),
        401: unauthenticated,
        403: deactivated,
        404: errorResponse(
          'No such quiz, or one the caller does not own. Ownership failures are reported as 404 on purpose.',
          ['QUIZ_NOT_FOUND']
        )
      }
    },
    delete: {
      summary: 'Delete a quiz',
      description: `Deletes a quiz and returns the row as it was, so the client can offer an undo. Sessions already created from it keep their own snapshot and are unaffected. Only the owner may delete, and for anybody else the quiz simply does not exist. ${AUTH_NOTE}`,
      tags: [quizTag.name],
      parameters: [quizIdParam],
      responses: {
        200: successResponse({
          description: 'The quiz as it was just before deletion.',
          data: quizData
        }),
        401: unauthenticated,
        403: deactivated,
        404: errorResponse(
          'No such quiz, one the caller does not own, or one that was already deleted',
          ['QUIZ_NOT_FOUND']
        )
      }
    }
  }
}
