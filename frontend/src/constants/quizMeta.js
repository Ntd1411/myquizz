/**
 * Presentational constants for quiz browsing.
 *
 * These are not data: `quiz_category` and `quiz_language` are free-text columns on
 * the backend (max 50 chars) and there is no taxonomy endpoint, so the chip list,
 * its sticker swatches and the language options are a client-side taxonomy. Only the
 * quizzes themselves come from the API.
 *
 * GAME_MODES is home-page copy. The playable mode rules live in GET /games/game-modes;
 * keep the names here in sync with that response.
 */
export const CATEGORIES = [
  { name: 'General', color: '#615d59' },
  { name: 'Science', color: '#2a9d99' },
  { name: 'Geography', color: '#1aae39' },
  { name: 'Movies', color: '#dd5b00' },
  { name: 'Sports', color: '#ff64c8' },
  { name: 'Music', color: '#391c57' },
]

/**
 * Values written into `quiz_language` by the editor. The search endpoint matches the
 * column exactly, so these codes must stay identical on both screens.
 */
export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
]

/**
 * Sorts accepted by GET /quizzes/search. An empty value is sent as no `sort` at all:
 * the backend then falls back to relevance with a keyword and to newest without one.
 */
export const SEARCH_SORTS = [
  { value: '', label: 'Best match' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'most_played', label: 'Most played' },
  { value: 'trending', label: 'Trending' },
  { value: 'name_asc', label: 'Name A\u2013Z' },
  { value: 'name_desc', label: 'Name Z\u2013A' },
]

/** Sorts accepted by GET /quizzes/me. `recently_updated` is the backend default. */
export const LIBRARY_SORTS = [
  { value: 'recently_updated', label: 'Recently updated' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name_asc', label: 'Name A\u2013Z' },
]

/** Sorts accepted by GET /quizzes/users/id/:ownerId. */
export const PROFILE_SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'most_played', label: 'Most played' },
  { value: 'name_asc', label: 'Name A\u2013Z' },
]

export const GAME_MODES = [
  {
    name: 'Classic',
    desc: 'Host-paced, whole room in lockstep. Everyone answers the same question at once.',
  },
  {
    name: 'Solo',
    desc: 'Self-paced. Play the whole set at your own speed and compare scores at the end.',
  },
  {
    name: 'Survival',
    desc: 'Three lives. A wrong answer or a timeout costs a life - last player standing wins.',
  },
  {
    name: 'Marathon',
    desc: 'Beat the clock. Loop the question bank until the total time budget runs out.',
  },
  {
    name: 'Practice',
    desc: 'No pressure, no score. Instant answers and review to actually learn.',
  },
]
