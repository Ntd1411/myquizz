/**
 * Types shared by the home and feed endpoints.
 *
 * `section_type` lives here as a union with a runtime list so services never
 * hard-code section strings. Adding a new row kind means touching this file and
 * the dispatcher in home.service.ts, and the compiler points at both.
 */

export const SECTION_TYPES = [
  'featured',
  'continue',
  'trending',
  'newest',
  'category'
] as const

export type SectionType = (typeof SECTION_TYPES)[number]

/** One configuration row from `home_sections`. Holds no quiz list itself. */
export interface HomeSectionConfig {
  id: number;
  section_key: string;
  title: string;
  section_type: SectionType;
  category_name: string | null;
  item_limit: number;
  position: number;
  is_active: boolean;
}

/**
 * The public identity of a quiz author, joined into every card and summary.
 *
 * Only the three fields a card needs are exposed; email, phone and role stay
 * private. A card carries owner: null when the author row was soft deleted, so
 * the client can show a neutral label instead of a broken name.
 */
export interface QuizOwner {
  id: number;
  fullname: string;
  avatar: string | null;
}

/**
 * The shape every quiz card in every row shares.
 *
 * Everything client-facing goes through the single mapper in feed.repository.ts,
 * so adding a field here means changing one function, not each caller.
 */
export interface QuizCard {
  id: number;
  quiz_name: string;
  quiz_description: string | null;
  quiz_image: string | null;
  quiz_category: string | null;
  quiz_language: string;
  quiz_owner: number;
  owner: QuizOwner | null;
  question_count: number;
  play_count: number;
  completion_rate: number;
  created_at: string;
}

/** A horizontal row on the home screen, after its items were resolved. */
export interface HomeSection {
  section_key: string;
  title: string;
  section_type: SectionType;
  items: QuizCard[];
}

/** One page of the infinite feed. */
export interface FeedPage {
  items: QuizCard[];
  nextCursor: string | null;
  hasMore: boolean;
}
