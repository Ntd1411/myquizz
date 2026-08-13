/**
 * Presentational constants for quiz browsing.
 *
 * These are not data: `quiz_category` and `quiz_language` are free-text columns on
 * the backend (max 50 chars) and there is no taxonomy endpoint, so the chip list,
 * its swatches and the language options are a client-side taxonomy. Only the quizzes
 * themselves come from the API.
 *
 * Colours come from the design v2.1 answer quartet. The quartet has four slots and the
 * taxonomy has six entries, so two categories reuse a slot on purpose - the label does
 * the disambiguating, the colour only has to keep the grid from turning into one grey
 * block. Tags always use the tinted half; the solid half belongs to answer tiles.
 *
 * CATEGORIES is no longer a browsing filter: the category chips were removed from the
 * home feed and the discover rail because a hardcoded taxonomy cannot match the
 * free-text column. It survives only as the lookup behind categoryTheme(), so a known
 * category keeps a stable colour until a real taxonomy endpoint exists.
 */

/** The four answer colours, plus the neutral used when nothing else fits. */
export const ANSWER_THEMES = {
  a: { slot: 'a', color: '#ef4b45', tint: '#fdeceb' },
  b: { slot: 'b', color: '#2f6be0', tint: '#eaf1fe' },
  c: { slot: 'c', color: '#f2b32e', tint: '#fef5e3' },
  d: { slot: 'd', color: '#1ba968', tint: '#e7f7f0' },
  neutral: { slot: 'neutral', color: '#565968', tint: '#f1f1f5' },
}

export const CATEGORIES = [
  { name: 'General', ...ANSWER_THEMES.neutral },
  { name: 'Science', ...ANSWER_THEMES.b },
  { name: 'Geography', ...ANSWER_THEMES.d },
  { name: 'Movies', ...ANSWER_THEMES.a },
  { name: 'Sports', ...ANSWER_THEMES.c },
  { name: 'Music', ...ANSWER_THEMES.b },
]

const THEME_CYCLE = [ANSWER_THEMES.a, ANSWER_THEMES.b, ANSWER_THEMES.c, ANSWER_THEMES.d]

/**
 * Theme for any category string, including the free-text ones users type themselves.
 * Known categories keep their fixed colour; anything else is hashed into the quartet so
 * the same word always renders the same way.
 */
export function categoryTheme(name) {
  const key = (name || '').trim()
  if (!key) return ANSWER_THEMES.neutral

  const known = CATEGORIES.find((category) => category.name.toLowerCase() === key.toLowerCase())
  if (known) return { slot: known.slot, color: known.color, tint: known.tint }

  let hash = 0
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) % 9973
  return THEME_CYCLE[hash % THEME_CYCLE.length]
}

/**
 * Values written into `quiz_language` by the editor. The search endpoint matches the
 * column exactly, so these codes must stay identical to the ones the editor writes
 * (utils/quizImport.js) - a language offered on only one of the two screens is either
 * unsearchable or unfilterable.
 */
export const LANGUAGES = [
  { value: 'vi', label: 'Vietnamese' },
  { value: 'en', label: 'English' },
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
