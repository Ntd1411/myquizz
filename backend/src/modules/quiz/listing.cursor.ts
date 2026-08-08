import { createHash } from 'node:crypto'
import { AppError } from '../../shared/errors/AppError.js'
import { LIST_SORTS, SORT_PRIMARY_KIND } from './listing.type.js'
import type { ListSort } from './listing.type.js'

const CURSOR_VERSION = 'v1'
const FIELD_SEPARATOR = '|'
const FINGERPRINT_LENGTH = 8

/**
 * Keyset position at the end of a page, plus the context it was produced in.
 *
 * sort and filterHash travel inside the cursor so the server can reject a
 * cursor that is replayed against a different ordering or a different filter
 * set; either would otherwise silently return meaningless rows.
 */
export interface ListCursor {
  sort: ListSort;
  filterHash: string;
  // Primary ORDER BY value of the last row, kept verbatim as a string: a
  // timestamp must not be reparsed into a float (which drops microseconds) and
  // a name must keep its exact bytes.
  primaryValue: string;
  id: number;
}

// Values a listing filter can hold before it is fingerprinted. All primitives,
// so String() below always produces something meaningful.
export type FilterInput = Record<string, string | number | boolean | null | undefined>

const SORT_VALUES = new Set<string>(LIST_SORTS)

/**
 * Timestamp shape the listing repository must emit for timestamp-sorted
 * cursors, via to_char(value at time zone 'UTC',
 * 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), e.g. 2026-08-09T05:34:56.123456Z.
 * Validation only: the original string is passed through untouched so
 * microsecond precision survives to the SQL cast.
 */
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{1,6}Z$/

/**
 * Stable 8-char fingerprint of the filters a listing was produced with.
 *
 * Keys are sorted before hashing so property order never changes the result,
 * and null/undefined entries are dropped so an absent filter and an explicit
 * null collapse together. This is an integrity check, not a security boundary:
 * a collision only ever costs the client one restart from the first page.
 */
export function computeFilterFingerprint(filters: FilterInput): string {
  const normalized = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('&')

  return createHash('sha1')
    .update(normalized)
    .digest('hex')
    .slice(0, FINGERPRINT_LENGTH)
}

/**
 * Serializes a keyset position into an opaque base64url token.
 *
 * The primary value is base64url-encoded before being joined so it can safely
 * contain the field separator: quiz names are free text and may hold '|'.
 */
export function encodeListCursor(cursor: ListCursor): string {
  const encodedPrimary = Buffer.from(cursor.primaryValue, 'utf8').toString('base64url')

  const raw = [
    CURSOR_VERSION,
    cursor.sort,
    cursor.filterHash,
    encodedPrimary,
    String(cursor.id)
  ].join(FIELD_SEPARATOR)

  return Buffer.from(raw, 'utf8').toString('base64url')
}

/**
 * Parses a client-supplied cursor, throwing AppError(400) on anything that
 * does not match the current request.
 *
 * A cursor is user input that reaches a SQL comparison, so every part is
 * validated rather than trusted. Buffer.from(..., 'base64url') never throws (it
 * silently drops invalid characters), so all real checks happen on the decoded
 * parts here, not around the decode call.
 */
export function decodeListCursor(
  raw: string,
  expected: { sort: ListSort; filterHash: string }
): ListCursor {
  const decoded = Buffer.from(raw, 'base64url').toString('utf8')
  const parts = decoded.split(FIELD_SEPARATOR)

  if (parts.length !== 5) {
    throw new AppError(400, 'Invalid cursor')
  }

  const [version, sort, filterHash, encodedPrimary, rawId] = parts

  // Under noUncheckedIndexedAccess these read as string | undefined; one empty
  // check both satisfies the type and rejects a cursor with blank fields.
  if (!version || !sort || !filterHash || !encodedPrimary || !rawId) {
    throw new AppError(400, 'Invalid cursor')
  }

  if (version !== CURSOR_VERSION) {
    throw new AppError(400, 'Invalid cursor')
  }

  // Must be a real sort and the exact ordering requested now: pairing a cursor
  // with a different sort would walk the wrong column.
  if (!isListSort(sort) || sort !== expected.sort) {
    throw new AppError(400, 'Invalid cursor')
  }

  // Must be the same filter set, or it would page through unrelated rows.
  if (filterHash !== expected.filterHash) {
    throw new AppError(400, 'Invalid cursor')
  }

  const id = Number(rawId)

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'Invalid cursor')
  }

  const primaryValue = Buffer.from(encodedPrimary, 'base64url').toString('utf8')

  if (!isValidPrimaryValue(sort, primaryValue)) {
    throw new AppError(400, 'Invalid cursor')
  }

  return { sort, filterHash, primaryValue, id }
}

function isListSort(value: string): value is ListSort {
  return SORT_VALUES.has(value)
}

/**
 * Rejects a primary value whose type does not match its sort, so a tampered
 * cursor fails as a 400 here instead of as a driver 500 at the SQL cast.
 */
function isValidPrimaryValue(sort: ListSort, value: string): boolean {
  if (!value) {
    return false
  }

  const kind = SORT_PRIMARY_KIND[sort]

  if (kind === 'number') {
    return Number.isFinite(Number(value))
  }

  if (kind === 'timestamp') {
    return TIMESTAMP_PATTERN.test(value)
  }

  return value.length > 0
}
