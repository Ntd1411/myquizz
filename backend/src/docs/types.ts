/**
 * Structural helpers for the hand-written OpenAPI document.
 *
 * The specification is plain data, so it is typed loosely on purpose: the goal
 * is to keep the document composable across files, not to re-implement the
 * OpenAPI meta-schema in TypeScript. The helpers below exist because every
 * endpoint repeats the same envelope, reference and error shapes.
 *
 * Authentication is deliberately absent from this file. The access token lives
 * in an HttpOnly cookie that the browser attaches by itself, so the document
 * declares no security scheme: a cookie scheme would make the reference UI
 * render an editable Cookie field and send an empty one next to the real one.
 */

export type OpenApiObject = Record<string, unknown>

export type SchemaMap = Record<string, OpenApiObject>

export type PathMap = Record<string, OpenApiObject>

export interface TagObject {
  name: string
  description: string
}

/** One timestamp for every example, so the whole reference stays consistent. */
export const EXAMPLE_TIMESTAMP = '2026-08-12T03:00:00.000Z'

/** Appended to the operations that read the accessToken cookie. */
export const AUTH_NOTE =
  'Requires a signed-in session: call POST /auth/login once and the browser replays the accessToken cookie on this request.'

/** Appended to the operations that behave differently once a session exists. */
export const OPTIONAL_AUTH_NOTE =
  'Authentication is optional and read from the accessToken cookie when the browser has one.'

/** Pointer to a reusable schema under components.schemas. */
export const ref = (name: string): OpenApiObject => ({
  $ref: `#/components/schemas/${name}`
})

/** Inline object schema, used for one-off request and response payloads. */
export const object = (
  properties: SchemaMap,
  required?: string[]
): OpenApiObject =>
  required
    ? { type: 'object', required, properties }
    : { type: 'object', properties }

/** Array schema whose items are a reusable component. */
export const arrayOf = (name: string): OpenApiObject => ({
  type: 'array',
  items: ref(name)
})

/**
 * data.message payload. These endpoints answer with one fixed sentence, so the
 * exact string thrown by the controller is documented as the only allowed
 * value instead of a generic 'string'.
 */
export const messageData = (message: string): OpenApiObject =>
  object({ message: { type: 'string', enum: [message], example: message } }, [
    'message'
  ])

/** Wraps a payload in the success envelope to build a full response example. */
export const successExample = (
  data: unknown,
  meta?: Record<string, unknown>
): OpenApiObject => ({
  success: true,
  data,
  error: null,
  meta: { timestamp: EXAMPLE_TIMESTAMP, ...meta }
})

/**
 * Successful responses only differ by the shape of data, so the payload is
 * layered on top of SuccessEnvelope instead of repeating the envelope fields.
 */
export const successResponse = (args: {
  description: string
  data: OpenApiObject
  meta?: OpenApiObject
  example?: unknown
  examples?: OpenApiObject
}): OpenApiObject => {
  const properties: SchemaMap = { data: args.data }

  if (args.meta) {
    properties.meta = args.meta
  }

  const content: OpenApiObject = {
    schema: {
      allOf: [ref('SuccessEnvelope'), { type: 'object', properties }]
    }
  }

  if (args.example !== undefined) {
    content.example = args.example
  }

  if (args.examples) {
    content.examples = args.examples
  }

  return {
    description: args.description,
    content: { 'application/json': content }
  }
}

/** One failure the API can actually produce, with the message from the code. */
export type ErrorCase = string | { message: string; details: unknown }

/**
 * Failure responses all share the error envelope, so the only interesting part
 * is the message. Every case listed at a call site is copied verbatim from the
 * controller or service that throws it, and the reference renders one
 * selectable example per message rather than an empty generic string.
 */
export const errorResponse = (
  description: string,
  cases: ErrorCase[]
): OpenApiObject => {
  const examples: OpenApiObject = {}

  for (const entry of cases) {
    const message = typeof entry === 'string' ? entry : entry.message
    const details = typeof entry === 'string' ? null : entry.details

    examples[message] = {
      summary: message,
      value: {
        success: false,
        data: null,
        error: { message, details },
        meta: { timestamp: EXAMPLE_TIMESTAMP }
      }
    }
  }

  return {
    description,
    content: {
      'application/json': { schema: ref('ErrorEnvelope'), examples }
    }
  }
}

/** Body rejected by a Zod schema before the controller ever runs. */
export const validationError = (details: Record<string, string>): ErrorCase => ({
  message: 'Validation error',
  details
})

/**
 * JSON request body, required unless stated otherwise.
 *
 * `example` is what the reference UI copies into the request editor when the
 * user hits 'Test Request', so every documented body ships a payload that can
 * be sent as-is against a seeded development database.
 */
export const jsonBody = (
  schema: OpenApiObject,
  options?: {
    required?: boolean
    description?: string
    example?: unknown
    examples?: OpenApiObject
  }
): OpenApiObject => {
  const content: OpenApiObject = { schema }

  if (options?.example !== undefined) {
    content.example = options.example
  }

  if (options?.examples) {
    content.examples = options.examples
  }

  const body: OpenApiObject = {
    required: options?.required ?? true,
    content: { 'application/json': content }
  }

  if (options?.description) {
    body.description = options.description
  }

  return body
}
