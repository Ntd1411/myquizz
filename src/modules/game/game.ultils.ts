import crypto from 'crypto'

export function generateSessionCode(length: number = 6): string {
  const characters = '0123456789'
  let code = ''

  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, characters.length)
    code += characters[randomIndex]
  }

  return code
}

export function calculateScore(
  isCorrect: boolean,
  timeTaken: number,
  timeLimit: number
): number {
  if (!isCorrect) {
    return 0
  }

  const baseScore = 1000
  const timeBonus = ((timeLimit - timeTaken) / timeLimit) * 500

  return Math.round(baseScore + Math.max(0, timeBonus))
}

export function validateSessionCode(code: string): boolean {
  return /^[A-Z0-9]{6,10}$/.test(code)
}

export function sanitizePlayerName(name: string): string {
  return name.trim().slice(0, 50)
}

export function calculateRank(leaderboard: Array<{ player_score: number }>): Array<{ rank: number }> {
  const sorted = [...leaderboard].sort((a, b) => b.player_score - a.player_score)

  return sorted.map((entry, index, arr) => {
    if (index === 0) {
      return { ...entry, rank: 1 }
    }

    const prevEntry = arr[index - 1]
    if (!prevEntry) {
      return { ...entry, rank: index + 1 }
    }

    const rank = entry.player_score === prevEntry.player_score
      ? (prevEntry as any).rank
      : index + 1

    return { ...entry, rank }
  })
}
