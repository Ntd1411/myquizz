import crypto from 'crypto'
import type { GameSession } from './game.type.js'

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

export function calculateRank<T extends { player_score: number }>(
  leaderboard: T[]
): Array<T & { rank: number }> {
  const sorted = [...leaderboard].sort((a, b) => b.player_score - a.player_score)

  return sorted.map((entry, index, arr) => {
    if (index === 0) {
      return { ...entry, rank: 1 }
    }

    const prevEntry = arr[index - 1]
    if (!prevEntry) {
      return { ...entry, rank: index + 1 }
    }

    const prevEntryWithRank = prevEntry as T & { rank: number }
    const rank = entry.player_score === prevEntry.player_score
      ? prevEntryWithRank.rank
      : index + 1

    return { ...entry, rank }
  })
}

export function toStringRecord<T extends object>(obj: T): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k,
      v == null ? '' : String(v)
    ])
  )
}

export function convertToGameSessionFromHash(hash: Record<string, string>): GameSession {
  return {
    id: parseInt(hash.id as string, 10),
    quiz_snapshot_id: parseInt(hash.quiz_snapshot_id as string, 10),
    session_name: hash.session_name as string,
    session_code: hash.session_code as string,
    session_host: parseInt(hash.session_host as string, 10),
    total_players: parseInt(hash.total_players as string, 10),
    total_questions: parseInt(hash.total_questions as string, 10),
    session_status: hash.session_status as GameSession['session_status'],
    created_at: new Date(hash.created_at as string),
    updated_at: new Date(hash.updated_at as string),
    started_at: hash.started_at ? new Date(hash.started_at) : null,
    finished_at: hash.finished_at ? new Date(hash.finished_at) : null
  }
}
