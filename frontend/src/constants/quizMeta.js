/**
 * Presentational constants for quiz browsing.
 *
 * These are not data: `quiz_category` is a free-text column on the backend (max 50
 * chars) and there is no categories endpoint, so the chip list and its sticker
 * swatches are a client-side taxonomy. Only the quizzes themselves come from the API.
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
