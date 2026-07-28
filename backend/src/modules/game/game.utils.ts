export function mergeConfig<T extends Record<string, unknown>>(base: T, patch: Partial<T>): T {
  const out = { ...base } as Record<string, unknown>
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = mergeConfig(
        (out[k] ?? {}) as Record<string, unknown>,
        v as Partial<Record<string, unknown>>
      )
    } else {
      out[k] = v
    }
  }
  return out as T
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const generateSessionCode = (len = 6): string =>
  Array.from({ length: len }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')

// Calculate rank by player score descending
export const calculateRank = <T extends { player_score: number }>(
  players: T[]
): Array<T & { rank: number }> =>
    [...players]
      .sort((a, b) => b.player_score - a.player_score)
      .map((p, i) => ({ ...p, rank: i + 1 }))

// Deterministic Fisher-Yates: the same seed always produces the same order, so a
// cache re-warm or a second process never reorders a running session.
export const seededShuffle = <T>(items: T[], seed: number): T[] => {
  const out = [...items]
  let state = seed >>> 0 || 1
  for (let i = out.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0 // linear congruential generator
    const j = state % (i + 1)
    const tmp = out[i] as T
    out[i] = out[j] as T
    out[j] = tmp
  }
  return out
}
