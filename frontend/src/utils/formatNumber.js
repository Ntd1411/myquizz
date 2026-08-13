/**
 * Number formatting for the numeric face (Martian Mono).
 *
 * A real space is far too wide in a monospaced font: "1 204" reads as two separate
 * numbers. The design instead splits thousands with a fixed 0.2em sliver, rendered as
 * `<i class="ts"></i>` between the groups, so a template does:
 *
 *   <span class="num">
 *     <template v-for="(group, i) in groupDigits(count)">
 *       <i v-if="i" class="ts" /><span>{{ group }}</span>
 *     </template>
 *   </span>
 */

/** Splits a number into thousands groups: 1204 -> ['1', '204']. */
export function groupDigits(value) {
  const rounded = Math.trunc(Math.abs(Number(value) || 0))
  const digits = String(rounded)
  const groups = []

  for (let end = digits.length; end > 0; end -= 3) {
    groups.unshift(digits.slice(Math.max(0, end - 3), end))
  }

  const sign = Number(value) < 0 ? '-' : ''
  if (sign && groups.length) groups[0] = sign + groups[0]
  return groups
}

/** Plain string form for titles, aria labels and anything outside the numeric face. */
export function formatCount(value) {
  return groupDigits(value).join(',')
}
