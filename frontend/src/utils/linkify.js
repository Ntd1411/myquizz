/**
 * Intro text rendering, shared by every card that prints an account's description:
 * the library header, the public profile and the account settings page.
 *
 * An intro is plain text the account typed, but a URL inside it should be clickable.
 * Splitting the text into runs lets the template render links as real nodes and
 * everything else as text, so Vue keeps escaping it. Building an HTML string here and
 * feeding it to v-html would hand every account an injection point on its own profile.
 *
 *   <template v-for="part in bioParts" :key="part.key">
 *     <a v-if="part.type === 'link'" :href="part.href" target="_blank" rel="noopener noreferrer">{{ part.text }}</a>
 *     <span v-else>{{ part.text }}</span>
 *   </template>
 */

// Bare URLs typed into the intro. The trailing class drops sentence punctuation that
// happens to sit after a link, so "see example.com." does not linkify the full stop.
const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,:;"')\]}!?])/gi

/**
 * Splits text into plain runs and link runs.
 *
 * @param {string} text Raw intro text; an empty or missing value yields no parts.
 * @returns {Array<{ key: number, type: 'text' | 'link', text: string, href?: string }>}
 */
export function toTextParts(text) {
  const source = text ?? ''
  const parts = []
  let cursor = 0
  let index = 0

  for (const match of source.matchAll(URL_PATTERN)) {
    if (match.index > cursor) {
      parts.push({ key: index++, type: 'text', text: source.slice(cursor, match.index) })
    }
    parts.push({
      key: index++,
      type: 'link',
      text: match[0],
      // A "www." link without a scheme would resolve against our own origin.
      href: match[0].startsWith('www.') ? `https://${match[0]}` : match[0],
    })
    cursor = match.index + match[0].length
  }

  if (cursor < source.length) {
    parts.push({ key: index++, type: 'text', text: source.slice(cursor) })
  }

  return parts
}
